import { expect, test } from "vitest"
import { sessionProjectFolder, workspaceLocation } from "./workspace-location.ts"

const folders = ["/w/api", "/w/web"]
const fresh = {
  projectPath: "/w/shop.code-workspace",
  workingFolder: "/w/shop.code-workspace",
  inWorktree: false,
  started: false,
  branch: null,
}

test("a new session is on a new worktree with all projects until it picks another place", () => {
  expect(workspaceLocation(fresh, { kind: "checkout" }, folders, [])).toEqual({
    kind: "worktree",
    label: "All projects / New worktree",
    branch: null,
  })
  expect(workspaceLocation(fresh, { kind: "new_worktree", folder: "/w/web" }, folders, [])).toEqual(
    { kind: "worktree", label: "web / New worktree", branch: null },
  )
})

test("a session moved to one project folder shows it like a project of its own", () => {
  const onApi = { ...fresh, workingFolder: "/w/api", branch: "main" }
  expect(workspaceLocation(onApi, { kind: "checkout" }, folders, [])).toEqual({
    kind: "checkout",
    label: "api / Current checkout",
    branch: "main",
  })
  const inWorktree = { ...onApi, workingFolder: "/w/api/.worktrees/x", inWorktree: true }
  expect(workspaceLocation(inWorktree, { kind: "checkout" }, folders, []).label).toBe(
    "api / Worktree",
  )
})

test("a working folder whose worktrees differ shows each repository's branch", () => {
  const path = "/root/shop/ivin-1"
  const session = { ...fresh, workingFolder: path, inWorktree: true, started: true }
  const differing = {
    path,
    branch: null,
    repositories: [
      { name: "api", branch: "ivin/1" },
      { name: "web", branch: "fix/badge" },
    ],
  }
  expect(workspaceLocation(session, { kind: "checkout" }, folders, [differing])).toEqual({
    kind: "worktree",
    label: "All projects / Worktree",
    branch: "api ivin/1 · web fix/badge",
  })
})

test("a project folder is found from its checkout or a worktree under it, not a lookalike", () => {
  const at = (workingFolder: string, inWorktree: boolean) =>
    sessionProjectFolder({ projectPath: "", workingFolder, inWorktree }, folders)
  expect(at("/w/web", false)).toBe("/w/web")
  expect(at("/w/web/.worktrees/a", true)).toBe("/w/web")
  expect(at("/w/web-2/.worktrees/a", true)).toBeNull()
})
