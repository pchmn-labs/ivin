import { expect, test } from "vitest"
import { timeLimitOf } from "./git-time-limit.ts"

test("a command that writes the working tree, or a fetch, gets the long limit", () => {
  for (const args of [
    ["checkout", "--quiet", "main", "--"],
    ["worktree", "add", "--no-track", "-b", "x", "/w", "main"],
    ["stash", "push"],
    ["commit", "--quiet", "--all", "-m", "x"],
    ["merge", "--ff-only", "origin/main"],
    ["--literal-pathspecs", "restore", "--staged", "--worktree", "--", "a.ts"],
    ["fetch", "--quiet", "origin"],
  ])
    expect(timeLimitOf(args)).toBe("long")
})

test("any other command gets the short limit", () => {
  for (const args of [
    ["--no-optional-locks", "--literal-pathspecs", "diff", "--name-status"],
    ["worktree", "list", "--porcelain"],
    ["rev-parse", "HEAD"],
  ])
    expect(timeLimitOf(args)).toBe("short")
})
