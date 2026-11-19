import { expect, test } from "vitest"
import { newBranchLabel, sessionLocation } from "./session-location.ts"

const checkout = { workingFolder: "/p", inWorktree: false, branch: "main" }
const notStarted = { ...checkout, started: false }

test("a session on the checkout shows its branch", () => {
  expect(sessionLocation({ ...checkout, started: true }, { kind: "checkout" }, [])).toEqual({
    kind: "checkout",
    label: "Current checkout",
    branch: "main",
  })
})

test("before the first message, a new worktree has no branch yet", () => {
  expect(sessionLocation(notStarted, { kind: "new_worktree" }, [])).toEqual({
    kind: "worktree",
    label: "New worktree",
    branch: null,
  })
})

test("before the first message, an existing worktree shows its branch, or its folder when detached", () => {
  const worktrees = [{ path: "/p/.worktrees/adr", branch: "docs/adr" }]
  const chosen = (path: string) =>
    sessionLocation(notStarted, { kind: "existing_worktree", path }, worktrees).branch
  expect(chosen("/p/.worktrees/adr")).toBe("docs/adr")
  expect(chosen("/p/.worktrees/detached")).toBe("detached")
})

test("once started, the session's own folder wins over the choice", () => {
  const started = {
    workingFolder: "/p/.worktrees/x",
    inWorktree: true,
    branch: "ivin/x",
    started: true,
  }
  expect(sessionLocation(started, { kind: "checkout" }, [])).toEqual({
    kind: "worktree",
    label: "Worktree",
    branch: "ivin/x",
  })
})

test("outside a git repository, the location is the folder", () => {
  const plain = { workingFolder: "/notes", inWorktree: false, branch: null, started: true }
  expect(sessionLocation(plain, { kind: "checkout" }, [])).toEqual({
    kind: "folder",
    label: "/notes",
    branch: null,
  })
})

test("a new worktree's branch says what it starts from", () => {
  expect(newBranchLabel("origin/main", "main")).toBe("New branch from origin/main")
  expect(newBranchLabel("HEAD", "feat/x")).toBe("New branch from feat/x")
  expect(newBranchLabel(null, "main")).toBe("New branch")
})
