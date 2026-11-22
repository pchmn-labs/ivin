import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

// The pnpm the tests run, when the desktop app gives the server none.
export const installedPnpmFolder = () => dirname(createRequire(import.meta.url).resolve("pnpm"))

export const pnpmVersion = async (pnpmFolder: string) => {
  const text = await readFile(join(pnpmFolder, "package.json"), "utf8").catch(() => {
    throw new Error(`ivin's pnpm is missing from ${pnpmFolder}: reinstall ivin.`)
  })
  return (JSON.parse(text) as { version: string }).version
}

export interface PnpmRun {
  readonly ok: boolean
  readonly output: string
}

const TIMEOUT_MS = 5 * 60_000

export const runPnpm = (
  pnpmFolder: string,
  ivinHome: string,
  cwd: string,
  args: ReadonlyArray<string>,
) =>
  new Promise<PnpmRun>((resolve) => {
    execFile(
      process.execPath,
      [
        join(pnpmFolder, "bin", "pnpm.mjs"),
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
