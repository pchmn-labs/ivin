import { PluginNotLocked } from "@ivin/contracts/plugin"
import { Effect, Layer } from "effect"
import { createHash } from "node:crypto"
import {
  appendFile,
  copyFile,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"
import type { PluginTree, TreeFile } from "../rules/plugin-diff.ts"
import { pluginTemplate } from "../rules/plugin-template.ts"
import {
  PluginNotChecked,
  PluginNotCompiled,
  PluginNotMade,
  UserPlugins,
  type PluginFolder,
} from "../usecases/user-plugins.ts"
import { pluginFolderChanges } from "./plugin-folder-changes.ts"
import { pluginTypePaths } from "./plugin-types.ts"
import { checkTypes } from "./ts-check.ts"
import { makePluginDependencies } from "./plugin-dependencies.ts"
import { bundle, contentHashOf, filesOf, hashOf } from "./plugin-bundler.ts"
import { layerFsPluginSwitches } from "./fs-plugin-switches.ts"
import { installedPnpmFolder } from "./pnpm.ts"

const isSafeName = (name: string) => name !== "" && !name.startsWith(".") && !/[/\\\0]/.test(name)

const readText = (path: string) => readFile(path, "utf8").catch(() => null)
const isFolder = (path: string) =>
  stat(path).then(
    (s) => s.isDirectory(),
    () => false,
  )
const isFile = (path: string) =>
  stat(path).then(
    (s) => s.isFile(),
    () => false,
  )

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

const foldersIn = async (root: string) => {
  const names = await readdir(root).catch(() => [])
  const folders: PluginFolder[] = []
  for (const name of names.filter(isSafeName).sort()) {
    const path = join(root, name)
    // Followed, so a plugin can be a link to the folder its author works in.
    if (await isFolder(path)) {
      folders.push({ name, path, manifest: await readText(join(path, "package.json")) })
    }
  }
  return folders
}

const isBinary = (bytes: Buffer) => bytes.includes(0)

const readTree = async (path: string) => {
  if (!(await isFolder(path))) return null
  const folder = await realpath(path)
  const files = new Map<string, TreeFile>()
  for (const file of await filesOf(folder)) {
    const bytes = await readFile(join(folder, file)).catch(() => null)
    if (bytes === null) continue
    files.set(file, {
      text: isBinary(bytes) ? null : bytes.toString("utf8"),
      digest: createHash("sha256").update(bytes).digest("hex"),
    })
  }
  return { hash: await contentHashOf(folder), files: files as PluginTree }
}

// `pnpmFolder` is the pnpm and `toolsFolder` the type checker and types the desktop app ships; the tests run the ones in node_modules.
// `safe` loads no user or project plugin and ignores the list of disabled plugins.
export const layerFsUserPlugins = (
  ivinHome: string,
  pnpmFolder?: string,
  toolsFolder?: string,
  { safe = false }: { readonly safe?: boolean } = {},
) => {
  const trustFolder = join(ivinHome, "cache", "plugin-trust")
  const dependencies = makePluginDependencies(ivinHome, pnpmFolder ?? installedPnpmFolder())
  const pluginsFolder = join(ivinHome, "plugins")
  const cacheFolder = join(ivinHome, "cache", "plugins")
  const logFolder = join(ivinHome, "logs", "plugins")
  const logFile = (id: string) => (isSafeName(id) ? join(logFolder, `${id}.log`) : null)

  const userPlugins = Layer.succeed(UserPlugins)({
    folders: Effect.promise(() => foldersIn(pluginsFolder)),
    changes: pluginFolderChanges(pluginsFolder),
    foldersIn: (root) => Effect.promise(() => foldersIn(root)),
    projectChanges: (project) => pluginFolderChanges(join(project, ".ivin", "plugins"), false),
    readTree: (path) => Effect.promise(() => readTree(path)),
    keepTrusted: (hash, path) =>
      Effect.promise(async () => {
        const target = join(trustFolder, hash)
        if (await isFolder(target)) return target
        const folder = await realpath(path)
        // Built beside the target and renamed into place, so a copy found there is complete.
        const partial = `${target}.${process.pid}.partial`
        for (const file of await filesOf(folder)) {
          await mkdir(dirname(join(partial, file)), { recursive: true, mode: 0o700 })
          await copyFile(join(folder, file), join(partial, file))
        }
        await mkdir(partial, { recursive: true, mode: 0o700 })
        await rename(partial, target).catch(async (error: NodeJS.ErrnoException) => {
          if (!(await isFolder(target))) throw error
        })
        return target
      }),
    trustedFolder: (hash) =>
      Effect.promise(async () => {
        const target = join(trustFolder, hash)
        return (await isFolder(target)) ? target : null
      }),
    bundlePath: (name) => join(cacheFolder, name),
    check: (path) =>
      Effect.tryPromise({
        try: async () => checkTypes(await realpath(path), toolsFolder),
        catch: (error) => new PluginNotChecked({ reason: messageOf(error) }),
      }),
    create: (id) =>
      Effect.tryPromise({
        try: async () => {
          const folder = join(pluginsFolder, id)
          await mkdir(pluginsFolder, { recursive: true, mode: 0o700 })
          // Fails when the folder exists, so two creations never write into each other.
          await mkdir(folder)
          for (const [file, text] of Object.entries(
            pluginTemplate(id, pluginTypePaths(toolsFolder)),
          )) {
            await mkdir(dirname(join(folder, file)), { recursive: true })
            await writeFile(join(folder, file), text)
          }
          return folder
        },
        catch: (error) => new PluginNotMade({ reason: messageOf(error) }),
      }),
    compile: ({ id, path, entry, half }) =>
      Effect.tryPromise({
        try: async () => {
          // Rolldown names files from the real path, relative to `cwd`.
          const folder = await realpath(path)
          const entryPath = resolve(folder, entry)
          if (!entryPath.startsWith(folder + sep)) {
            throw new Error(`ivin.${half}, ${entry}, leads out of the plugin's folder.`)
          }
          // A `.mjs` so Node reads the server half as an ES module wherever the cache sits.
          const name = `${await hashOf(folder, entry, half)}${half === "ui" ? ".js" : ".mjs"}`
          const file = join(cacheFolder, name)
          if (await isFile(file)) return name
          const installed = await dependencies.install(
            id,
            folder,
            (await readText(join(folder, "package.json"))) ?? "{}",
          )
          const files = await bundle(folder, entryPath, installed, name, half).catch(
            (error: unknown) => {
              throw new Error(`Could not compile ${entry}: ${messageOf(error)}`)
            },
          )
          await mkdir(cacheFolder, { recursive: true, mode: 0o700 })
          // Chunks first and the entry last, so a bundle found in the cache is complete.
          for (const { fileName, code } of files.toSorted(
            (a, b) => Number(a.fileName === name) - Number(b.fileName === name),
          )) {
            const target = join(cacheFolder, fileName)
            await mkdir(dirname(target), { recursive: true, mode: 0o700 })
            // Renamed into place, so a killed write never leaves a partial file under a valid name.
            const partial = `${target}.${process.pid}.partial`
            await writeFile(partial, code)
            await rename(partial, target)
          }
          return name
        },
        catch: (error) => new PluginNotCompiled({ reason: messageOf(error) }),
      }),
    lock: (path) =>
      Effect.tryPromise({
        try: async () =>
          dependencies.lock(path, (await readText(join(path, "package.json"))) ?? "{}"),
        catch: (error) => new PluginNotLocked({ reason: messageOf(error) }),
      }),
    appendLog: (id, line) =>
      Effect.tryPromise(async () => {
        const file = logFile(id)
        if (file === null) return
        await mkdir(logFolder, { recursive: true, mode: 0o700 })
        await appendFile(file, `${line.replaceAll("\n", " ")}\n`)
      }).pipe(
        Effect.catch((error) => Effect.logWarning(`could not write the log of ${id}`, error)),
      ),
    readLog: (id) =>
      Effect.promise(async () => {
        const file = logFile(id)
        const text = file === null ? null : await readText(file)
        return text === null ? [] : text.split("\n").filter((line) => line !== "")
      }),
  })
  return Layer.mergeAll(userPlugins, layerFsPluginSwitches(ivinHome, safe))
}
