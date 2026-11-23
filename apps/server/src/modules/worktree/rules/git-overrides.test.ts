import { expect, test } from "vitest"
import { withOverrides } from "./git-overrides.ts"

test("a read command runs with no fsmonitor and no hooks", () => {
  expect(withOverrides(["--no-optional-locks", "status", "--porcelain"])).toEqual([
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.hooksPath=/dev/null",
    "--no-optional-locks",
    "status",
    "--porcelain",
  ])
})

test("listing worktrees is a read, adding one is not", () => {
  expect(withOverrides(["worktree", "list", "--porcelain"])).toContain("core.hooksPath=/dev/null")
  expect(withOverrides(["worktree", "add", "-b", "x", "/w", "main"])).not.toContain(
    "core.hooksPath=/dev/null",
  )
})

test("a command the user asked for keeps the repository's hooks", () => {
  for (const command of ["commit", "checkout", "merge"])
    expect(withOverrides([command, "--quiet"])).toEqual([
      "-c",
      "core.fsmonitor=false",
      command,
      "--quiet",
    ])
})

test("a fetch never runs a transport command named by the ext protocol", () => {
  expect(withOverrides(["fetch", "--quiet", "origin"])).toEqual([
    "-c",
    "core.fsmonitor=false",
    "-c",
    "protocol.ext.allow=never",
    "fetch",
    "--quiet",
    "origin",
  ])
})
