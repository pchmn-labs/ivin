import {
  HOST_MODULES,
  HOST_MODULES_GLOBAL,
  PluginNotLocked,
  SERVER_HOST_MODULES,
} from "@ivin/contracts/plugin"
import { Effect, Layer } from "effect"
import rolldownPackage from "rolldown/package.json" with { type: "json" }
import { createHash } from "node:crypto"
import { isBuiltin } from "node:module"
import { existsSync } from "node:fs"
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
import { dirname, join, relative, resolve, sep } from "node:path"
import { PluginNotCompiled, UserPlugins, type PluginFolder } from "../usecases/user-plugins.ts"
import { makePluginDependencies, type Installed } from "./plugin-dependencies.ts"
import { installedPnpmFolder } from "./pnpm.ts"

type Half = "ui" | "server"

const HOST_PREFIX = "\0ivin-host:"
// Bumped when a change to how plugins compile must invalidate the cached bundles.
const COMPILE_VERSION = `3 ${rolldownPackage.version} ${HOST_MODULES.join(" ")} ${SERVER_HOST_MODULES.join(" ")}`
const PROVIDED_PACKAGES = ["react", "react-dom", "@ivin/plugin-api"]

const isBare = (specifier: string) =>
  !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("\0")
const packageOf = (specifier: string) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/")

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

// Every file the bundle can depend on, in a stable order.
const filesOf = async (folder: string): Promise<string[]> => {
  const entries = await readdir(folder, { withFileTypes: true, recursive: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    .filter(
      (path) => !path.split(sep).some((part) => part.startsWith(".") || part === "node_modules"),
    )
    .sort()
}

const hashOf = async (folder: string, entry: string, half: Half) => {
  const hash = createHash("sha256").update(`${COMPILE_VERSION}\0${half}\0${entry}\0`)
  for (const path of await filesOf(folder)) {
    hash
      .update(`${path}\0`)
      .update(await readFile(join(folder, path)))
      .update("\0")
  }
  return hash.digest("hex")
}

// Copied beside the server bundle by its build; the tests find it in node_modules.
const shippedBinding = join(import.meta.dirname, "native", "rolldown-binding.node")

const loadRolldown = async () => {
  if (!existsSync(shippedBinding)) return import("rolldown")
  // Read once, as the binding loads, and kept out of the agents' environment.
  process.env["NAPI_RS_NATIVE_LIBRARY_PATH"] = shippedBinding
  try {
    return await import("rolldown")
  } finally {
    delete process.env["NAPI_RS_NATIVE_LIBRARY_PATH"]
  }
}

const isUnder = (path: string | undefined, folder: string) =>
  path !== undefined && path.startsWith(folder + sep)

const bundle = async (
  folder: string,
  entry: string,
  installed: Installed | null,
  name: string,
  half: Half,
) => {
  const hostModules: ReadonlyArray<string> = half === "ui" ? HOST_MODULES : SERVER_HOST_MODULES
  const { rolldown } = await loadRolldown()
  const build = await rolldown({
    input: entry,
    cwd: folder,
    platform: half === "ui" ? "browser" : "node",
    onLog: (level, log, handle) => {
      if (log.code === "UNRESOLVED_IMPORT") handle("error", log)
    },
    transform: { define: { "process.env.NODE_ENV": JSON.stringify("production") } },
    plugins: [
      {
        name: "ivin-plugin-imports",
        async resolveId(specifier, importer) {
          // Before any other rule, so a dependency's imports of React get the host's too.
          if (hostModules.includes(specifier)) {
            return HOST_PREFIX + specifier
          }
          // Rolldown's own output imports `node:module` for a Node target.
          if (half === "server" && isBuiltin(specifier)) return { id: specifier, external: true }
          if (!isBare(specifier)) return null
          const name = packageOf(specifier)
          if (PROVIDED_PACKAGES.includes(name)) {
            throw new Error(`It imports ${specifier}, which ivin does not provide to plugins.`)
          }
          if (installed !== null && isUnder(importer, installed.folder)) {
            // Default resolution would also look in the folders above the install.
            const resolved = await this.resolve(specifier, importer, { skipSelf: true })
            if (
              resolved !== null &&
              !resolved.external &&
              !isUnder(resolved.id, installed.folder)
            ) {
              throw new Error(`A dependency imports ${specifier}, which is not installed with it.`)
            }
            return resolved
          }
          if (installed === null || !installed.names.has(name)) {
            throw new Error(`It imports ${specifier}, which is not in its dependencies.`)
          }
          return this.resolve(specifier, join(installed.folder, "package.json"), {
            skipSelf: true,
          })
        },
        load(id) {
          if (!id.startsWith(HOST_PREFIX)) return null
          const name = JSON.stringify(id.slice(HOST_PREFIX.length))
          return {
            code: `module.exports = globalThis[${JSON.stringify(HOST_MODULES_GLOBAL)}][${name}]`,
            moduleType: "js",
          }
        },
      },
    ],
  })
  try {
    // The chunks sit in a folder named after the entry, which imports them relatively.
    const { output } = await build.generate({
      format: "esm",
      entryFileNames: name,
      chunkFileNames: `${name.slice(0, name.lastIndexOf("."))}/[name]-[hash]${name.slice(name.lastIndexOf("."))}`,
    })
    return output.map((file) => ({
      fileName: file.fileName,
      code: file.type === "chunk" ? file.code : String(file.source),
    }))
  } finally {
    await build.close()
  }
}

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
