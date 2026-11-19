import { expect, test } from "vitest"
import { linkedWorktrees } from "./linked-worktrees.ts"

const entry = (path: string, branch: string | null, prunable = false) => ({
  path,
  branch,
  prunable,
})

test("the project's worktrees leave out its checkout and the ones whose folder is gone", () => {
  expect(
    linkedWorktrees("/repo", [
      entry("/repo", "main"),
      entry("/repo/.worktrees/feat-login", "feat/login"),
      entry("/repo/.worktrees/gone", "gone", true),
      entry("/elsewhere/detached", null),
    ]),
  ).toEqual([
    { path: "/repo/.worktrees/feat-login", branch: "feat/login" },
    { path: "/elsewhere/detached", branch: null },
  ])
})

test("a project opened on a linked worktree lists the others, not itself", () => {
  expect(
    linkedWorktrees("/repo/.worktrees/a", [
      entry("/repo", "main"),
      entry("/repo/.worktrees/a", "a"),
      entry("/repo/.worktrees/b", "b"),
    ]),
  ).toEqual([{ path: "/repo/.worktrees/b", branch: "b" }])
})
