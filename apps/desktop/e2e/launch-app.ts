import { _electron as electron, type ElectronApplication } from "@playwright/test"
import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const releaseDir = join(dirname(fileURLToPath(import.meta.url)), "../release")

export const packagedExecutable =
  process.platform === "darwin"
    ? join(releaseDir, "mac-arm64/ivin.app/Contents/MacOS/ivin")
    : join(releaseDir, "linux-unpacked/ivin")

export const makeTempDir = (prefix: string): string =>
  mkdtempSync(join(tmpdir(), `ivin-${prefix}-`))

export const launchPackagedApp = (userDataDir: string): Promise<ElectronApplication> => {
  if (!existsSync(packagedExecutable)) {
    throw new Error(`Packaged app not found at ${packagedExecutable}: run pnpm package first`)
  }
  return electron.launch({
    executablePath: packagedExecutable,
    args: [`--user-data-dir=${userDataDir}`],
  })
}
