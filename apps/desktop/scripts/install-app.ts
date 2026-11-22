import { execFileSync } from "node:child_process"
import { renameSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const installed = "/Applications/ivin.app"
const staged = "/Applications/ivin.app.new"

const isIvinRunning = () => {
  try {
    execFileSync("pgrep", ["-x", "ivin"])
    return true
  } catch {
    return false
  }
}

if (process.platform !== "darwin") {
  console.error("install-app only installs the macOS app.")
  process.exit(1)
}
// Deleting the bundle of a running ivin breaks the helper processes it starts later.
if (isIvinRunning()) {
  console.error("Quit ivin first, then run `pnpm install-app` again.")
  process.exit(1)
}

execFileSync("pnpm", ["package"], { cwd: join(desktopDir, "../.."), stdio: "inherit" })

rmSync(staged, { recursive: true, force: true })
execFileSync("ditto", [join(desktopDir, "release/mac-arm64/ivin.app"), staged])
rmSync(installed, { recursive: true, force: true })
renameSync(staged, installed)
console.log(`Installed ${installed}.`)
