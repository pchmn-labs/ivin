import { createHash, randomUUID } from "node:crypto"
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { join, relative, sep } from "node:path"
import {
  type Dependencies,
  dependenciesOf,
  installManifest,
  pnpmError,
  relativeLocalDependency,
} from "../rules/dependencies.ts"
import { PNPM_VERSION, runPnpm } from "./pnpm.ts"

export interface Installed {
  readonly folder: string
  readonly names: ReadonlySet<string>
}

const LOCKFILE = "pnpm-lock.yaml"

class OutdatedLockfile extends Error {}

const readText = (path: string) => readFile(path, "utf8").catch(() => null)

// A folder beside the installs, so the relative paths pnpm writes for `file:` dependencies hold in both.
const scratchFolder = async (depsFolder: string, kind: string) => {
  const folder = join(depsFolder, `.${kind}-${randomUUID()}`)
  await mkdir(folder, { recursive: true })
  return folder
}

// The first installed package that ships or builds a native module.
const nativePackage = async (installFolder: string): Promise<string | null> => {
  const store = join(installFolder, "node_modules", ".pnpm")
  const entries = await readdir(store, { recursive: true, withFileTypes: true }).catch(() => [])
  const native = entries.find(
    (entry) => entry.isFile() && (entry.name === "binding.gyp" || entry.name.endsWith(".node")),
  )
  if (native === undefined) return null
  const parts = relative(store, join(native.parentPath, native.name)).split(sep)
  const name = parts.slice(parts.indexOf("node_modules") + 1)
  return (name[0]?.startsWith("@") ? name.slice(0, 2) : name.slice(0, 1)).join("/")
}

const assertNoRelativeLocalDependency = (dependencies: Dependencies) => {
  const name = relativeLocalDependency(dependencies)
  if (name !== null) {
    throw new Error(`Its dependency ${name} is a relative path: give file: an absolute path.`)
  }
}

export const makePluginDependencies = (ivinHome: string) => {
  const depsFolder = join(ivinHome, "cache", "plugins", "deps")
  const installing = new Map<string, Promise<string>>()

  const install = async (key: string, dependencies: Dependencies, lockfile: string) => {
    const folder = join(depsFolder, key)
    if ((await readText(join(folder, "package.json"))) !== null) return folder
    const scratch = await scratchFolder(depsFolder, "install")
    try {
      await writeFile(join(scratch, "package.json"), installManifest(dependencies))
      await writeFile(join(scratch, LOCKFILE), lockfile)
      const run = await runPnpm(ivinHome, scratch, ["install", "--frozen-lockfile"])
      if (!run.ok) {
        const { code, message } = pnpmError(run.output)
        if (code === "ERR_PNPM_OUTDATED_LOCKFILE") throw new OutdatedLockfile()
        throw new Error(`Could not install its dependencies: ${message}`)
      }
      const native = await nativePackage(scratch)
      if (native !== null) {
        throw new Error(`Its dependency ${native} needs native code, which ivin does not build.`)
      }
      // Renamed into place, so a killed install never leaves a half-filled folder under a valid key.
      await rename(scratch, folder).catch(async (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error
      })
      return folder
    } finally {
      await rm(scratch, { recursive: true, force: true })
    }
  }

  return {
    // Null when the plugin has no dependencies; throws the reason a plugin's author reads.
    install: async (
      id: string,
      pluginFolder: string,
      packageJson: string,
    ): Promise<Installed | null> => {
      const dependencies = dependenciesOf(packageJson)
      if (Object.keys(dependencies).length === 0) return null
      assertNoRelativeLocalDependency(dependencies)
      const lockfile = await readText(join(pluginFolder, LOCKFILE))
      if (lockfile === null) {
        throw new Error(`It has dependencies and no ${LOCKFILE}: run ivin plugin lock ${id}.`)
      }
      const key = createHash("sha256")
        .update(`${PNPM_VERSION}\0${installManifest(dependencies)}\0${lockfile}`)
        .digest("hex")
      const pending = installing.get(key) ?? install(key, dependencies, lockfile)
      installing.set(key, pending)
      try {
        // Real, so it compares with the paths Rolldown resolves.
        return { folder: await realpath(await pending), names: new Set(Object.keys(dependencies)) }
      } catch (error) {
        if (!(error instanceof OutdatedLockfile)) throw error
        throw new Error(
          `Its ${LOCKFILE} does not match the dependencies in its package.json: run ivin plugin lock ${id}.`,
        )
      } finally {
        installing.delete(key)
      }
    },
    lock: async (pluginFolder: string, packageJson: string) => {
      const dependencies = dependenciesOf(packageJson)
      assertNoRelativeLocalDependency(dependencies)
      const scratch = await scratchFolder(depsFolder, "lock")
      try {
        await writeFile(join(scratch, "package.json"), installManifest(dependencies))
        await copyFile(join(pluginFolder, LOCKFILE), join(scratch, LOCKFILE)).catch(() => undefined)
        const run = await runPnpm(ivinHome, scratch, ["install", "--lockfile-only"])
        if (!run.ok) throw new Error(pnpmError(run.output).message)
        await copyFile(join(scratch, LOCKFILE), join(pluginFolder, LOCKFILE))
      } finally {
        await rm(scratch, { recursive: true, force: true })
      }
    },
  }
}
