import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, sep } from "node:path"

// Copied beside the server bundle by its build, outside the asar archive; the tests use node_modules.
const shippedPnpm = join(import.meta.dirname, "pnpm")

const pnpmFolder = existsSync(shippedPnpm)
  ? shippedPnpm.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`)
  : dirname(createRequire(import.meta.url).resolve("pnpm"))

export const PNPM_VERSION = (
  JSON.parse(readFileSync(join(pnpmFolder, "package.json"), "utf8")) as { version: string }
).version

const pnpmEntry = () => join(pnpmFolder, "bin", "pnpm.mjs")

export interface PnpmRun {
  readonly ok: boolean
  readonly output: string
}

const TIMEOUT_MS = 5 * 60_000

export const runPnpm = (ivinHome: string, cwd: string, args: ReadonlyArray<string>) =>
  new Promise<PnpmRun>((resolve) => {
    execFile(
      process.execPath,
      [
        pnpmEntry(),
        ...args,
        "--ignore-workspace",
        "--ignore-scripts",
        "--config.auto-install-peers=false",
        `--store-dir=${join(ivinHome, "cache", "pnpm-store")}`,
        `--config.cache-dir=${join(ivinHome, "cache", "pnpm-cache")}`,
      ],
      {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          // Electron's binary runs as Node; plain Node ignores it.
          ELECTRON_RUN_AS_NODE: "1",
          npm_config_manage_package_manager_versions: "false",
          npm_config_update_notifier: "false",
        },
      },
      (error, stdout, stderr) => resolve({ ok: error === null, output: `${stdout}\n${stderr}` }),
    )
  })
