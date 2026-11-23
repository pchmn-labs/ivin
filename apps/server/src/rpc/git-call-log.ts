import { execFileSync } from "node:child_process"
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

// Puts first on the PATH a `git` that logs its arguments, one call per line, then runs the real one.
export const logGitCalls = () => {
  const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim()
  const dir = mkdtempSync(join(tmpdir(), "ivin-git-log-"))
  const log = join(dir, "calls.log")
  writeFileSync(join(dir, "git"), `#!/bin/sh\necho "$*" >> '${log}'\nexec '${realGit}' "$@"\n`)
  chmodSync(join(dir, "git"), 0o755)
  const path = process.env["PATH"]
  process.env["PATH"] = `${dir}${delimiter}${path ?? ""}`
  return {
    calls: () =>
      existsSync(log)
        ? readFileSync(log, "utf8")
            .split("\n")
            .filter((line) => line !== "")
        : [],
    clear: () => rmSync(log, { force: true }),
    restore: () => {
      process.env["PATH"] = path
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
