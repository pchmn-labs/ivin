import { expect, test } from "vitest"
import { parseBranches, parseWorktreeList, underOpenedPath } from "./git-output.ts"

test("the porcelain worktree list gives each worktree's path and branch", () => {
  const output = [
    "worktree /repo",
    "HEAD 1111111111111111111111111111111111111111",
    "branch refs/heads/main",
    "",
    "worktree /repo/.worktrees/feat-login",
    "HEAD 2222222222222222222222222222222222222222",
    "branch refs/heads/feat/login",
    "",
    "worktree /repo/.worktrees/detached",
    "HEAD 3333333333333333333333333333333333333333",
    "detached",
    "prunable gitdir file points to non-existent location",
    "",
  ].join("\n")

  expect(parseWorktreeList(output)).toEqual([
    { path: "/repo", branch: "main", prunable: false },
    { path: "/repo/.worktrees/feat-login", branch: "feat/login", prunable: false },
    { path: "/repo/.worktrees/detached", branch: null, prunable: true },
  ])
})

test("refs split into local and remote branches, without the remote's HEAD", () => {
  const output = [
    "refs/heads/main",
    "refs/heads/feat/login",
    "refs/remotes/origin/HEAD",
    "refs/remotes/origin/main",
    "refs/remotes/origin/fix/a",
    "",
  ].join("\n")

  expect(parseBranches(output)).toEqual({
    local: ["main", "feat/login"],
    remote: ["origin/main", "origin/fix/a"],
  })
})

test("worktree paths under the resolved repository take the path it was opened with", () => {
  const entry = (path: string) => ({ path, branch: null, prunable: false })
  expect(
    underOpenedPath(
      [
        entry("/private/var/repo"),
        entry("/private/var/repo/.worktrees/a"),
        entry("/private/var/repo-b"),
      ],
      "/var/repo",
      "/private/var/repo",
    ).map((e) => e.path),
  ).toEqual(["/var/repo", "/var/repo/.worktrees/a", "/private/var/repo-b"])
})
