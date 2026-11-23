import { HOST_MODULES, HOST_MODULES_GLOBAL, PluginNotLocked } from "@ivin/contracts/plugin"
import { Effect, Layer } from "effect"
import rolldownPackage from "rolldown/package.json" with { type: "json" }
import { createHash } from "node:crypto"
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
import { join, relative, resolve, sep } from "node:path"
import { PluginNotCompiled, UserPlugins, type PluginFolder } from "../usecases/user-plugins.ts"
import { makePluginDependencies, type Installed } from "./plugin-dependencies.ts"
import { installedPnpmFolder } from "./pnpm.ts"

const HOST_PREFIX = "\0ivin-host:"
// Bumped when a change to how plugins compile must invalidate the cached bundles.
const COMPILE_VERSION = `1 ${rolldownPackage.version} ${HOST_MODULES.join(" ")}`
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

const hashOf = async (folder: string, entry: string) => {
  const hash = createHash("sha256").update(`${COMPILE_VERSION}\0${entry}\0`)
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

const bundle = async (folder: string, entry: string, installed: Installed | null) => {
  const { rolldown } = await loadRolldown()
  const build = await rolldown({
    input: entry,
    cwd: folder,
    platform: "browser",
    onLog: (level, log, handle) => {
      if (log.code === "UNRESOLVED_IMPORT") handle("error", log)
    },
    transform: { define: { "process.env.NODE_ENV": JSON.stringify("production") } },
    plugins: [
      {
        name: "ivin-plugin-imports",
        async resolveId(specifier, importer) {
          // Before any other rule, so a dependency's imports of React get the host's too.
          if ((HOST_MODULES as ReadonlyArray<string>).includes(specifier)) {
            return HOST_PREFIX + specifier
          }
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
    const { output } = await build.generate({ format: "esm", codeSplitting: false })
    return output[0].code
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
    compile: ({ id, path, entry }) =>
      Effect.tryPromise({
        try: async () => {
          // Rolldown names files from the real path, relative to `cwd`.
          const folder = await realpath(path)
          const entryPath = resolve(folder, entry)
          if (!entryPath.startsWith(folder + sep)) {
            throw new Error(`ivin.ui, ${entry}, leads out of the plugin's folder.`)
          }
          const name = `${await hashOf(folder, entry)}.js`
          const file = join(cacheFolder, name)
          if (await isFile(file)) return name
          const installed = await dependencies.install(
            id,
            folder,
            (await readText(join(folder, "package.json"))) ?? "{}",
          )
          const code = await bundle(folder, entryPath, installed).catch((error: unknown) => {
            throw new Error(`Could not compile ${entry}: ${messageOf(error)}`)
          })
          await mkdir(cacheFolder, { recursive: true, mode: 0o700 })
          // Renamed into place, so a killed write never leaves a partial bundle under a valid name.
          const partial = `${file}.${process.pid}.partial`
          await writeFile(partial, code)
          await rename(partial, file)
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
