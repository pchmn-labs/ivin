import { expect, test } from "vitest"
import { resolveBranchPick } from "./branch-pick.ts"

const worktrees = [
  { path: "/repo", branch: "main", prunable: false },
  { path: "/repo/.worktrees/feat-login", branch: "feat/login", prunable: false },
]
const state = {
  workingFolder: "/repo",
  local: ["main", "feat/login", "fix/typo"],
  remote: ["origin/main", "origin/feat/login", "origin/fix/typo", "origin/feat/new"],
  worktrees,
}

test("a local branch no worktree holds is checked out in the working folder", () => {
  expect(resolveBranchPick({ name: "fix/typo", remote: false }, state)).toEqual({
    kind: "checkout",
    branch: "fix/typo",
  })
})

test("a remote branch with no local branch of its name becomes a tracking branch", () => {
  expect(resolveBranchPick({ name: "origin/feat/new", remote: true }, state)).toEqual({
    kind: "track",
    remote: "origin/feat/new",
    branch: "feat/new",
  })
})

test("a remote branch whose local branch exists picks the local branch", () => {
  expect(resolveBranchPick({ name: "origin/fix/typo", remote: true }, state)).toEqual({
    kind: "checkout",
    branch: "fix/typo",
  })
  expect(resolveBranchPick({ name: "origin/feat/login", remote: true }, state)).toEqual({
    kind: "move",
    path: "/repo/.worktrees/feat-login",
    branch: "feat/login",
  })
})

test("a branch held by another worktree moves the session to it, the checkout included", () => {
  expect(resolveBranchPick({ name: "feat/login", remote: false }, state)).toEqual({
    kind: "move",
    path: "/repo/.worktrees/feat-login",
    branch: "feat/login",
  })
  expect(
    resolveBranchPick(
      { name: "main", remote: false },
      { ...state, workingFolder: "/repo/.worktrees/feat-login" },
    ),
  ).toEqual({ kind: "move", path: "/repo", branch: "main" })
})

test("the branch of the session's own working folder changes nothing", () => {
  expect(resolveBranchPick({ name: "main", remote: false }, state)).toEqual({ kind: "current" })
})

test("a worktree whose folder is gone does not hold its branch", () => {
  expect(
    resolveBranchPick(
      { name: "fix/typo", remote: false },
      {
        ...state,
        worktrees: [
          ...worktrees,
          { path: "/repo/.worktrees/gone", branch: "fix/typo", prunable: true },
        ],
      },
    ),
  ).toEqual({ kind: "checkout", branch: "fix/typo" })
})

test("a name that is not among the listed branches resolves to unknown", () => {
  expect(resolveBranchPick({ name: "-f", remote: false }, state)).toEqual({ kind: "unknown" })
  expect(resolveBranchPick({ name: "origin/--detach", remote: true }, state)).toEqual({
    kind: "unknown",
  })
  expect(resolveBranchPick({ name: "fix/typo", remote: true }, state)).toEqual({ kind: "unknown" })
})
