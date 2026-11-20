import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const quoted = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`

export const cliScript = (electron: string, cliEntry: string) =>
  `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${quoted(electron)} ${quoted(cliEntry)} "$@"\n`

export const writeCliCommand = (folder: string, electron: string, cliEntry: string) => {
  mkdirSync(folder, { recursive: true })
  const path = join(folder, "ivin")
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, cliScript(electron, cliEntry))
  chmodSync(temporary, 0o755)
  // A rename, so an agent never runs half a script.
  renameSync(temporary, path)
  return path
}
