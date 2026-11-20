import { expect, test } from "vitest"
import { isInUse, isRemovable, removalCandidates, type SessionUse } from "./worktree-removal.ts"

const session = (workingFolder: string, use: Partial<SessionUse> = {}): SessionUse => ({
  workingFolder,
  inWorktree: workingFolder !== "/repo",
  workingFolderDeleted: false,
  tabJustClosed: false,
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
      session("/elsewhere/feat-c", { tabJustClosed: true }),
      session("/repo/.worktrees/feat-a", { tabJustClosed: true }),
      session("/repo/.worktrees/feat-a/packages/ui", { inUse: true }),
      session("/repo/.worktrees/feat-b", { inUse: true }),
    ]),
  ).toEqual([{ path: "/elsewhere/feat-c", origin: "closedSession" }])
})

test("the worktrees under .worktrees/ that no session in use is in are swept, others are not", () => {
  expect(
    removalCandidates("/repo", worktrees, [session("/repo/.worktrees/feat-b", { inUse: true })]),
  ).toEqual([{ path: "/repo/.worktrees/feat-a", origin: "sweep" }])
})

test("a worktree on a detached HEAD is never a candidate", () => {
  expect(
    removalCandidates(
      "/repo",
      [{ path: "/repo/.worktrees/detached", branch: null }],
      [session("/repo/.worktrees/detached", { tabJustClosed: true })],
    ),
  ).toEqual([])
})

test("the checkout and a folder that is no longer a worktree are never candidates", () => {
  expect(
    removalCandidates(
      "/repo",
      [],
      [
        session("/repo", { tabJustClosed: true }),
        session("/repo/.worktrees/gone", { tabJustClosed: true }),
        session("/repo/.worktrees/marked", { tabJustClosed: true, workingFolderDeleted: true }),
      ],
    ),
  ).toEqual([])
  expect(
    removalCandidates(
      "/repo",
      [{ path: "/repo", branch: "main" }],
      [session("/repo", { tabJustClosed: true, inWorktree: true })],
    ),
  ).toEqual([])
})

test("a closed session's worktree under .worktrees/ is a session candidate, listed once", () => {
  expect(
    removalCandidates("/repo", worktrees.slice(0, 1), [
      session("/repo/.worktrees/feat-a", { tabJustClosed: true }),
      session("/repo/.worktrees/feat-a", { tabJustClosed: true }),
    ]),
  ).toEqual([{ path: "/repo/.worktrees/feat-a", origin: "closedSession" }])
})

const state = { clean: true, merged: true, hasCommits: true }

test("a clean worktree whose branch is merged is removed", () => {
  expect(isRemovable("closedSession", state)).toBe(true)
  expect(isRemovable("sweep", state)).toBe(true)
})

test("a worktree with local changes or an unmerged branch is kept", () => {
  expect(isRemovable("closedSession", { ...state, clean: false })).toBe(false)
  expect(isRemovable("closedSession", { ...state, merged: false })).toBe(false)
  expect(isRemovable("sweep", { ...state, clean: false })).toBe(false)
  expect(isRemovable("sweep", { ...state, merged: false })).toBe(false)
})

test("a closed session's worktree with no commit of its own is removed, a swept one is kept", () => {
  expect(isRemovable("closedSession", { ...state, hasCommits: false })).toBe(true)
  expect(isRemovable("sweep", { ...state, hasCommits: false })).toBe(false)
})

test("a worktree is in use while a session in use works in it or in one of its folders", () => {
  const sessions = [session("/repo/.worktrees/feat-a/packages/ui", { inUse: true })]
  expect(isInUse("/repo/.worktrees/feat-a", sessions)).toBe(true)
  expect(isInUse("/repo/.worktrees/feat-ab", sessions)).toBe(false)
  expect(isInUse("/repo/.worktrees/feat-a", [session("/repo/.worktrees/feat-a")])).toBe(false)
})
