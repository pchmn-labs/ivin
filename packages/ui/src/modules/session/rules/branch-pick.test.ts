import { expect, test } from "vitest"
import { branchMark, pickPreview } from "./branch-pick.ts"

const session = { projectPath: "/repo", workingFolder: "/repo" }
type Branch = { name: string; remote: boolean; worktreePath: string | null }
const branches: Branch[] = [
  { name: "main", remote: false, worktreePath: "/repo" },
  { name: "feat/login", remote: false, worktreePath: "/repo/.worktrees/feat-login" },
  { name: "fix/typo", remote: false, worktreePath: null },
  { name: "origin/main", remote: true, worktreePath: null },
  { name: "origin/feat/login", remote: true, worktreePath: null },
  { name: "origin/feat/new", remote: true, worktreePath: null },
]
const [main, login, typo, originMain, originLogin, originNew] = branches as [
  Branch,
  Branch,
  Branch,
  Branch,
  Branch,
  Branch,
]

test("a local branch is marked current, held by the checkout, or held by a worktree", () => {
  expect(branchMark(main, session)).toBe("current")
  expect(branchMark(login, session)).toBe("worktree")
  expect(branchMark(typo, session)).toBeNull()
  expect(branchMark(main, { ...session, workingFolder: "/repo/.worktrees/feat-login" })).toBe(
    "checkout",
  )
})

test("a remote branch carries no mark, even when its local branch is held", () => {
  expect(branchMark(originMain, session)).toBeNull()
  expect(branchMark(originLogin, session)).toBeNull()
})

test("the preview says what picking a branch does", () => {
  expect(pickPreview(main, branches, session)).toBe("Already on main.")
  expect(pickPreview(typo, branches, session)).toBe("Checks out fix/typo in the checkout.")
  expect(pickPreview(login, branches, session)).toBe(
    "Moves this session to the worktree .worktrees/feat-login.",
  )
  expect(pickPreview(originNew, branches, session)).toBe(
    "Creates feat/new from origin/feat/new and tracks it, in the checkout.",
  )
  expect(pickPreview(originLogin, branches, session)).toBe(
    "Moves this session to the worktree .worktrees/feat-login.",
  )
  expect(
    pickPreview(main, branches, { ...session, workingFolder: "/repo/.worktrees/feat-login" }),
  ).toBe("Moves this session to the checkout.")
})
