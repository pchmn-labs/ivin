import { expect, test } from "vitest"
import { folderAfterTool, needsWorktreeList } from "./agent-worktree.ts"

// Tool calls and outputs as recorded in packages/harness/src/modules/claude/rules/fixtures/.
const checkout = "/private/tmp/ivin-rec/repo"
const claudeWorktree = `${checkout}/.claude/worktrees/try-adopt`
const added = `${checkout}/.worktrees/try-adopt`

const enterOutput = `Created worktree at “${claudeWorktree}” on branch “worktree-try-adopt”. The session is now working in the worktree. Use ExitWorktree to leave mid-session, or exit the session to be prompted.`
const exitOutput = `Exited worktree. Your work is preserved at “${claudeWorktree}” on branch “worktree-try-adopt”. Session is now back in “${checkout}”.`
const bash = (command: string) => ({ name: "Bash", input: { command, description: "" } })
const ok = (output: string) => ({ output, isError: false })

test("EnterWorktree moves the agent to the worktree its result names", () => {
  expect(
    folderAfterTool({
      call: { name: "EnterWorktree", input: { name: "try-adopt" } },
      result: ok(enterOutput),
      workingFolder: checkout,
      folders: [checkout, claudeWorktree],
      created: [],
    }),
  ).toBe(claudeWorktree)
})

test("ExitWorktree moves the agent back to the folder its result names last", () => {
  expect(
    folderAfterTool({
      call: { name: "ExitWorktree", input: { action: "keep" } },
      result: ok(exitOutput),
      workingFolder: claudeWorktree,
      folders: [checkout, claudeWorktree],
      created: [],
    }),
  ).toBe(checkout)
})

test("a worktree tool whose folder git does not list moves nothing", () => {
  expect(
    folderAfterTool({
      call: { name: "EnterWorktree", input: { name: "try-adopt" } },
      result: ok(enterOutput),
      workingFolder: checkout,
      folders: [checkout],
      created: [],
    }),
  ).toBeNull()
})

test("a failed tool call moves nothing", () => {
  expect(
    folderAfterTool({
      call: { name: "EnterWorktree", input: { name: "try-adopt" } },
      result: { output: enterOutput, isError: true },
      workingFolder: checkout,
      folders: [checkout, claudeWorktree],
      created: [],
    }),
  ).toBeNull()
})

test("creating a worktree with git worktree add does not move the agent into it", () => {
  expect(
    folderAfterTool({
      call: bash("git worktree add .worktrees/try-adopt -b try/adopt"),
      result: ok("Preparing worktree (new branch 'try/adopt')\nHEAD is now at 85e6a78 init"),
      workingFolder: checkout,
      folders: [checkout, added],
      created: [added],
    }),
  ).toBeNull()
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
  expect(
    folderAfterTool({
      call: bash(command),
      result: ok(""),
      workingFolder: checkout,
      folders: [checkout, added],
      created: [added],
    }),
  ).toBe(added)
})

test("a file edited in a worktree the agent created moves it there", () => {
  expect(
    folderAfterTool({
      call: { name: "Edit", input: { file_path: `${added}/README.md`, old_string: "a" } },
      result: ok("The file was updated."),
      workingFolder: checkout,
      folders: [checkout, added],
      created: [added],
    }),
  ).toBe(added)
})

test("a command naming a worktree the agent did not create moves nothing", () => {
  expect(
    folderAfterTool({
      call: bash("cd .worktrees/try-adopt && git log"),
      result: ok(""),
      workingFolder: checkout,
      folders: [checkout, added],
      created: [],
    }),
  ).toBeNull()
})

test("a path that only starts like the worktree's is not a mention of it", () => {
  expect(
    folderAfterTool({
      call: bash("cd .worktrees/try-adopt-2 && ls"),
      result: ok(""),
      workingFolder: checkout,
      folders: [checkout, added],
      created: [added],
    }),
  ).toBeNull()
})

test("git's worktree list is read after a shell command or a worktree tool only", () => {
  expect(needsWorktreeList({ name: "Bash", input: {} })).toBe(true)
  expect(needsWorktreeList({ name: "EnterWorktree", input: {} })).toBe(true)
  expect(needsWorktreeList({ name: "ExitWorktree", input: {} })).toBe(true)
  expect(needsWorktreeList({ name: "Read", input: {} })).toBe(false)
})
