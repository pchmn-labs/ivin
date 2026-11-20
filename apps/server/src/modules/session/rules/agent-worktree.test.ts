import type { ToolActivity } from "@ivin/harness"
import { expect, test } from "vitest"
import { folderAfterTool, needsWorktreeList } from "./agent-worktree.ts"

const checkout = "/repo"
const switched = `${checkout}/.claude/worktrees/try-adopt`
const added = `${checkout}/.worktrees/try-adopt`
const shell = (command: string): ToolActivity => ({ type: "shell", command })

const after = (activity: ToolActivity, created: readonly string[] = [added]) =>
  folderAfterTool({
    activity,
    workingFolder: checkout,
    folders: [checkout, switched, added],
    created,
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
      created: [],
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
