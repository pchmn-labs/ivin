import type { ToolActivity } from "@ivin/harness"
import { describe, expect, test } from "vitest"
import { folderAfterTool, folderMovedTo, needsWorktreeList } from "./agent-worktree.ts"

const checkout = "/repo"
const switched = `${checkout}/.claude/worktrees/try-adopt`
const added = `${checkout}/.worktrees/try-adopt`
const shell = (command: string): ToolActivity => ({ type: "shell", command })

const after = (activity: ToolActivity, adoptable: readonly string[] = [added]) =>
  folderAfterTool({
    activity,
    workingFolder: checkout,
    folders: [checkout, switched, added],
    adoptable,
  })

test("an agent switching to a folder git lists moves there", () => {
  expect(after({ type: "folder_switch", path: switched })).toBe(switched)
})

test("an agent switching back to the checkout moves there", () => {
  expect(
    folderAfterTool({
      activity: { type: "folder_switch", path: checkout },
      workingFolder: switched,
      folders: [checkout, switched],
      adoptable: [],
    }),
  ).toBe(checkout)
})

test("a switch to a folder git does not list moves nothing", () => {
  expect(after({ type: "folder_switch", path: "/elsewhere" })).toBeNull()
})

test("creating a worktree with git worktree add does not move the agent into it", () => {
  expect(after(shell("git worktree add .worktrees/try-adopt -b try/adopt"))).toBeNull()
})

test.each([
  ["a relative cd", "cd .worktrees/try-adopt && git branch --show-current"],
  [
    "a cd chained to its creation",
    "git worktree add .worktrees/try-adopt -b try/adopt && cd .worktrees/try-adopt",
  ],
  ["an absolute path", `pnpm --dir ${added}/packages/ui test`],
  ["a ./ path", "cd ./.worktrees/try-adopt"],
])("a command that runs in a worktree the agent created moves it there: %s", (_, command) => {
  expect(after(shell(command))).toBe(added)
})

test("another tool naming a file in a worktree the agent created moves it there", () => {
  expect(after({ type: "other", text: JSON.stringify({ file_path: `${added}/README.md` }) })).toBe(
    added,
  )
})

test("a command naming a worktree the agent did not create moves nothing", () => {
  expect(after(shell("cd .worktrees/try-adopt && git log"), [])).toBeNull()
})

test("a path that only starts like the worktree's is not a mention of it", () => {
  expect(after(shell("cd .worktrees/try-adopt-2 && ls"))).toBeNull()
})

test("git's worktree list is read after a shell command or a folder switch only", () => {
  expect(needsWorktreeList(shell("ls"))).toBe(true)
  expect(needsWorktreeList({ type: "folder_switch", path: switched })).toBe(true)
  expect(needsWorktreeList({ type: "other", text: "{}" })).toBe(false)
})

describe("folderMovedTo", () => {
  const moved = (workingFolder: string, listed: string[], appeared: string[]) =>
    folderMovedTo({ workingFolder, projectPath: "/p", listed: new Set(listed), appeared })

  test("follows the working folder to the one worktree that appeared as it left the list", () => {
    expect(moved("/p/.worktrees/a", ["/p/.worktrees/b"], ["/p/.worktrees/b"])).toBe(
      "/p/.worktrees/b",
    )
  })

  test("moves nothing when several worktrees appeared, since it cannot tell which", () => {
    expect(
      moved(
        "/p/.worktrees/a",
        ["/p/.worktrees/b", "/p/.worktrees/c"],
        ["/p/.worktrees/b", "/p/.worktrees/c"],
      ),
    ).toBeNull()
  })

  test("moves nothing while the working folder is still listed, or is the checkout", () => {
    expect(
      moved("/p/.worktrees/a", ["/p/.worktrees/a", "/p/.worktrees/b"], ["/p/.worktrees/b"]),
    ).toBeNull()
    expect(moved("/p", ["/p/.worktrees/b"], ["/p/.worktrees/b"])).toBeNull()
  })
})
