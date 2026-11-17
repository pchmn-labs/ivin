import { _electron as electron, type ElectronApplication } from "@playwright/test"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const releaseDir = join(dirname(fileURLToPath(import.meta.url)), "../release/mac-arm64")

export const packagedExecutable = join(releaseDir, "ivin.app/Contents/MacOS/ivin")

export const launchPackagedApp = (): Promise<ElectronApplication> => {
  if (!existsSync(packagedExecutable)) {
    throw new Error(`Packaged app not found at ${packagedExecutable}: run pnpm package first`)
  }
  return electron.launch({ executablePath: packagedExecutable })
}
