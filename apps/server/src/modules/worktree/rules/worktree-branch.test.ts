import { expect, test } from "vitest"
import { freeGeneratedBranch, generatedBranch, worktreePath } from "./worktree-branch.ts"

test("a new worktree's branch is named after the session id", () => {
  expect(generatedBranch("3f2a9c1e-77aa-4b2c-9d10-aa00bb11cc22")).toBe("ivin/3f2a9c1e")
})

test.each([
  ["/repo", "feat/login", "/repo/.worktrees/feat-login"],
  ["/repo/", "ivin/3f2a9c1e", "/repo/.worktrees/ivin-3f2a9c1e"],
  ["/r", "fix/a/b", "/r/.worktrees/fix-a-b"],
  ["/r", "plain", "/r/.worktrees/plain"],
])("the worktree of %s on %s is %s", (repo, branch, path) => {
  expect(worktreePath(repo, branch)).toBe(path)
})

test("a new worktree's branch skips the names a branch or a registered worktree already holds", () => {
  const id = "3f2a9c1e-77aa-4b2c-9d10-aa00bb11cc22"
  expect(freeGeneratedBranch("/r", id, { branches: [], paths: [] })).toBe("ivin/3f2a9c1e")
  expect(freeGeneratedBranch("/r", id, { branches: ["ivin/3f2a9c1e"], paths: [] })).toBe(
    "ivin/3f2a9c1e-2",
  )
  expect(
    freeGeneratedBranch("/r", id, {
      branches: ["ivin/3f2a9c1e"],
      paths: ["/r/.worktrees/ivin-3f2a9c1e-2"],
    }),
  ).toBe("ivin/3f2a9c1e-3")
})
