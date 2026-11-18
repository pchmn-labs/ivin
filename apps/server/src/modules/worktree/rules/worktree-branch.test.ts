import { expect, test } from "vitest"
import { branchFor, worktreePath } from "./worktree-branch.ts"

test("an empty or blank branch name gets one generated from the session id", () => {
  const sessionId = "3f2a9c1e-77aa-4b2c-9d10-aa00bb11cc22"
  expect(branchFor(null, sessionId)).toBe("ivin/3f2a9c1e")
  expect(branchFor("   ", sessionId)).toBe("ivin/3f2a9c1e")
})

test("a named branch is kept, trimmed", () => {
  expect(branchFor("  feat/login ", "3f2a9c1e")).toBe("feat/login")
})

test.each([
  ["/repo", "feat/login", "/repo/.worktrees/feat-login"],
  ["/repo/", "ivin/3f2a9c1e", "/repo/.worktrees/ivin-3f2a9c1e"],
  ["/r", "fix/a/b", "/r/.worktrees/fix-a-b"],
  ["/r", "plain", "/r/.worktrees/plain"],
])("the worktree of %s on %s is %s", (repo, branch, path) => {
  expect(worktreePath(repo, branch)).toBe(path)
})
