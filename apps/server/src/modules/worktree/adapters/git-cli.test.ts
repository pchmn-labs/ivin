import { Effect, Layer } from "effect"
import { execFileSync } from "node:child_process"
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { ProjectTrust } from "../../project/usecases/project-trust.ts"
import { Git } from "../usecases/git.ts"
import { layerGitCliWith } from "./git-cli.ts"

// Spawns a shell, sleep and pgrep.
vi.setConfig({ testTimeout: 5_000 })

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

// A process of this run's fake git, found by its unique argument.
const isRunning = (marker: string) => {
  try {
    execFileSync("pgrep", ["-f", `sleep ${marker}`])
    return true
  } catch {
    return false
  }
}

test("a git command that never exits fails with a GitError naming it, and its process is killed", async () => {
  const marker = String(600_000 + Math.floor(Math.random() * 100_000))
  writeFileSync(join(dir, "git"), `#!/bin/sh\nexec sleep ${marker}\n`)
  chmodSync(join(dir, "git"), 0o755)
  process.env["PATH"] = `${dir}${delimiter}${path ?? ""}`

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
  await expect.poll(() => isRunning(marker)).toBe(false)
})
