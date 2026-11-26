import { HOST_MODULES, HOST_MODULES_GLOBAL, SERVER_HOST_MODULES } from "@ivin/contracts/plugin"
import rolldownPackage from "rolldown/package.json" with { type: "json" }
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { isBuiltin } from "node:module"
import { join, relative, sep } from "node:path"
import type { Installed } from "./plugin-dependencies.ts"

export type Half = "ui" | "server"

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

export const hashOf = async (folder: string, entry: string, half: Half) => {
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

export const bundle = async (
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
