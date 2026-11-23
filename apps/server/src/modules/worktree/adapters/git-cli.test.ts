import { Effect, Layer } from "effect"
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { afterEach, beforeEach, expect, test } from "vitest"
import { ProjectTrust } from "../../project/usecases/project-trust.ts"
import { Git } from "../usecases/git.ts"
import { layerGitCliWith } from "./git-cli.ts"

let dir: string
let path: string | undefined

beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "ivin-git-cli-")))
  path = process.env["PATH"]
})

afterEach(() => {
  process.env["PATH"] = path
  rmSync(dir, { recursive: true, force: true })
})

const trustAll = Layer.succeed(ProjectTrust)({
  isTrusted: () => Effect.succeed(true),
  trust: () => Effect.void,
})

const isRunning = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

test("a git command that never exits fails with a GitError naming it, and its process is killed", async () => {
  const pidFile = join(dir, "pid")
  writeFileSync(join(dir, "git"), `#!/bin/sh\necho $$ > '${pidFile}'\nexec sleep 600\n`)
  chmodSync(join(dir, "git"), 0o755)
  process.env["PATH"] = `${dir}${delimiter}${path ?? ""}`

  const started = Date.now()
  const error = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* Git).listBranches(dir).pipe(Effect.flip)
    }).pipe(
      Effect.provide(
        layerGitCliWith({ short: "300 millis", long: "1 minutes" }).pipe(Layer.provide(trustAll)),
      ),
    ),
  )

  expect(error._tag).toBe("GitError")
  expect(error.message).toBe("git for-each-ref did not finish within 300 millis")
  expect(Date.now() - started).toBeLessThan(900)
  const pid = Number(readFileSync(pidFile, "utf8"))
  await expect.poll(() => isRunning(pid)).toBe(false)
})
