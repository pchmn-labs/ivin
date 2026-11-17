import { _electron as electron, type ElectronApplication } from "@playwright/test"
import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const releaseDir = join(dirname(fileURLToPath(import.meta.url)), "../release/mac-arm64")

export const packagedExecutable = join(releaseDir, "ivin.app/Contents/MacOS/ivin")

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
