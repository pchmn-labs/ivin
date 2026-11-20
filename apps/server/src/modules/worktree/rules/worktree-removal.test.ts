import { expect, test } from "vitest"
import { isRemovable, removalCandidates, type SessionUse } from "./worktree-removal.ts"

const session = (workingFolder: string, use: Partial<SessionUse> = {}): SessionUse => ({
  workingFolder,
  inWorktree: workingFolder !== "/repo",
  workingFolderDeleted: false,
  closed: false,
  inUse: false,
  ...use,
})

const worktrees = [
  { path: "/repo/.worktrees/feat-a", branch: "feat/a" },
  { path: "/repo/.worktrees/feat-b", branch: "feat/b" },
  { path: "/elsewhere/feat-c", branch: "feat/c" },
]

test("a closed session's worktree is a candidate once no session in use is in it", () => {
  expect(
    removalCandidates("/repo", worktrees, [
      session("/elsewhere/feat-c", { closed: true }),
      session("/repo/.worktrees/feat-a", { closed: true }),
      session("/repo/.worktrees/feat-a/packages/ui", { inUse: true }),
      session("/repo/.worktrees/feat-b", { inUse: true }),
    ]),
  ).toEqual([{ path: "/elsewhere/feat-c", origin: "session" }])
})

test("the worktrees under .worktrees/ that no session in use is in are swept", () => {
  expect(
    removalCandidates("/repo", worktrees, [session("/repo/.worktrees/feat-b", { inUse: true })]),
  ).toEqual([{ path: "/repo/.worktrees/feat-a", origin: "agent" }])
})

test("a worktree on a detached HEAD is never swept", () => {
  expect(
    removalCandidates("/repo", [{ path: "/repo/.worktrees/detached", branch: null }], []),
  ).toEqual([])
})

test("the checkout and a folder that is no longer a worktree are never candidates", () => {
  expect(
    removalCandidates(
      "/repo",
      [],
      [
        session("/repo", { closed: true }),
        session("/repo/.worktrees/gone", { closed: true }),
        session("/repo/.worktrees/marked", { closed: true, workingFolderDeleted: true }),
      ],
    ),
  ).toEqual([])
  expect(
    removalCandidates(
      "/repo",
      [{ path: "/repo", branch: "main" }],
      [session("/repo", { closed: true, inWorktree: true })],
    ),
  ).toEqual([])
})

test("a closed session's worktree under .worktrees/ is a session candidate, listed once", () => {
  expect(
    removalCandidates("/repo", worktrees.slice(0, 1), [
      session("/repo/.worktrees/feat-a", { closed: true }),
      session("/repo/.worktrees/feat-a", { closed: true }),
    ]),
  ).toEqual([{ path: "/repo/.worktrees/feat-a", origin: "session" }])
})

const state = { clean: true, merged: true, hasCommits: true }

test("a clean worktree whose branch is merged is removed", () => {
  expect(isRemovable("session", state)).toBe(true)
  expect(isRemovable("agent", state)).toBe(true)
})

test("a worktree with local changes or an unmerged branch is kept", () => {
  expect(isRemovable("session", { ...state, clean: false })).toBe(false)
  expect(isRemovable("session", { ...state, merged: false })).toBe(false)
  expect(isRemovable("agent", { ...state, clean: false })).toBe(false)
  expect(isRemovable("agent", { ...state, merged: false })).toBe(false)
})

test("a session's worktree with no commit of its own is removed, an agent's is kept", () => {
  expect(isRemovable("session", { ...state, hasCommits: false })).toBe(true)
  expect(isRemovable("agent", { ...state, hasCommits: false })).toBe(false)
})
