import { execFileSync } from "node:child_process"
import { cpSync, existsSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const built = join(dirname(fileURLToPath(import.meta.url)), "../release/mac-arm64/ivin.app")
const installed = "/Applications/ivin.app"

if (!existsSync(built)) {
  console.error(`No packaged app at ${built}: run \`pnpm package\` first.`)
  process.exit(1)
}

rmSync(installed, { recursive: true, force: true })
cpSync(built, installed, { recursive: true, verbatimSymlinks: true })
// The app is unsigned: without this, Gatekeeper refuses to open it.
execFileSync("xattr", ["-dr", "com.apple.quarantine", installed])

let running = false
try {
  execFileSync("pgrep", ["-x", "ivin"])
  running = true
} catch {}
console.log(
  `Installed ${installed}.${running ? " Quit and reopen ivin to run the new version." : ""}`,
)
