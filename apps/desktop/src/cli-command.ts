import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const quoted = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`

// The app's own Electron runs the CLI as Node, so `ivin` needs no Node installed.
export const cliScript = (electron: string, cliEntry: string) =>
  `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${quoted(electron)} ${quoted(cliEntry)} "$@"\n`

// Rewritten at each launch, so it follows the app when it moves; a rename, so an agent never runs half of it.
export const writeCliCommand = (folder: string, electron: string, cliEntry: string) => {
  mkdirSync(folder, { recursive: true })
  const path = join(folder, "ivin")
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, cliScript(electron, cliEntry))
  chmodSync(temporary, 0o755)
  renameSync(temporary, path)
  return path
}
