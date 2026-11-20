import type { HarnessOutput } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { decodeClaudeLine } from "./decode-claude-line.ts"
import enterWorktree from "./fixtures/enter-worktree.jsonl?raw"
import exitWorktree from "./fixtures/exit-worktree.jsonl?raw"
import gitWorktreeAdd from "./fixtures/git-worktree-add.jsonl?raw"
import toolCall from "./fixtures/tool-call.jsonl?raw"
import { toolActivity } from "./tool-activity.ts"

const activityOf = (fixture: string, tool: string) => {
  const events = fixture
    .split("\n")
    .filter((line) => line !== "")
    .flatMap(decodeClaudeLine)
  const call = events.find(
    (o): o is Extract<HarnessOutput, { type: "tool_call" }> =>
      o.type === "tool_call" && o.name === tool,
  )
  const result = events.find(
    (o): o is Extract<HarnessOutput, { type: "tool_result" }> =>
      o.type === "tool_result" && o.toolCallId === call?.toolCallId,
  )
  return call && result && toolActivity(call, result)
}

test("EnterWorktree switches the agent to the worktree it created", () => {
  expect(activityOf(enterWorktree, "EnterWorktree")).toEqual({
    type: "folder_switch",
    path: "/private/tmp/ivin-rec/repo/.claude/worktrees/try-adopt",
  })
})

test("ExitWorktree switches the agent back to the folder it left from", () => {
  expect(activityOf(exitWorktree, "ExitWorktree")).toEqual({
    type: "folder_switch",
    path: "/private/tmp/ivin-rec/repo",
  })
})

test("Bash is a shell command", () => {
  expect(activityOf(gitWorktreeAdd, "Bash")).toEqual({
    type: "shell",
    command: "git worktree add .worktrees/try-adopt -b try/adopt",
  })
})

test("another tool is described by its input", () => {
  expect(activityOf(toolCall, "Read")).toEqual({
    type: "other",
    text: '{"file_path":"/private/tmp/ivin-rec/note.txt"}',
  })
})

test("a worktree tool whose result names no folder is described by its input", () => {
  expect(
    toolActivity(
      { name: "ExitWorktree", input: { action: "keep" } },
      { output: "Not in a worktree." },
    ),
  ).toEqual({ type: "other", text: '{"action":"keep"}' })
})
