import { PluginNotLocked } from "@ivin/contracts/plugin"
import { Effect, Layer } from "effect"
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"
import { PluginNotCompiled, UserPlugins, type PluginFolder } from "../usecases/user-plugins.ts"
import { makePluginDependencies } from "./plugin-dependencies.ts"
import { bundle, hashOf } from "./plugin-bundler.ts"
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

// `pnpmFolder` is the pnpm the desktop app ships; the tests run the one in node_modules.
export const layerFsUserPlugins = (ivinHome: string, pnpmFolder?: string) => {
  const dependencies = makePluginDependencies(ivinHome, pnpmFolder ?? installedPnpmFolder())
  const pluginsFolder = join(ivinHome, "plugins")
  const cacheFolder = join(ivinHome, "cache", "plugins")
  const logFolder = join(ivinHome, "logs", "plugins")
  const logFile = (id: string) => (isSafeName(id) ? join(logFolder, `${id}.log`) : null)

  return Layer.succeed(UserPlugins)({
    folders: Effect.promise(async () => {
      const names = await readdir(pluginsFolder).catch(() => [])
      const folders: PluginFolder[] = []
      for (const name of names.filter(isSafeName).sort()) {
        const path = join(pluginsFolder, name)
        // Followed, so a plugin can be a link to the folder its author works in.
        if (await isFolder(path))
          folders.push({ name, path, manifest: await readText(join(path, "package.json")) })
      }
      return folders
    }),
    bundlePath: (name) => join(cacheFolder, name),
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
}
