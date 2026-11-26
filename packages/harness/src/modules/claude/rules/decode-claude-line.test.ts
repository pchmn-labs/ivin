import type { HarnessOutput } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { decodeClaudeLine } from "./decode-claude-line.ts"
import apiError from "./fixtures/api-error.jsonl?raw"
import backgroundAgent from "./fixtures/background-agent.jsonl?raw"
import backgroundCommand from "./fixtures/background-command.jsonl?raw"
import enterWorktree from "./fixtures/enter-worktree.jsonl?raw"
import exitWorktree from "./fixtures/exit-worktree.jsonl?raw"
import failedToolCall from "./fixtures/failed-tool-call.jsonl?raw"
import gitWorktreeAdd from "./fixtures/git-worktree-add.jsonl?raw"
import gitWorktreeAddFailed from "./fixtures/git-worktree-add-failed.jsonl?raw"
import permissionAllow from "./fixtures/permission-allow.jsonl?raw"
import permissionDeny from "./fixtures/permission-deny.jsonl?raw"
import interruption from "./fixtures/interruption.jsonl?raw"
import notLoggedIn from "./fixtures/not-logged-in.jsonl?raw"
import questionAnswer from "./fixtures/question-answer.jsonl?raw"
import questionDecline from "./fixtures/question-decline.jsonl?raw"
import plainAnswer from "./fixtures/plain-answer.jsonl?raw"
import resumedSession from "./fixtures/resumed-session.jsonl?raw"
import steer from "./fixtures/steer.jsonl?raw"
import thinking from "./fixtures/thinking.jsonl?raw"
import toolInterruption from "./fixtures/tool-interruption.jsonl?raw"
import toolCall from "./fixtures/tool-call.jsonl?raw"

const fixtures = {
  "api-error": apiError,
  "background-agent": backgroundAgent,
  "background-command": backgroundCommand,
  "enter-worktree": enterWorktree,
  "exit-worktree": exitWorktree,
  "git-worktree-add": gitWorktreeAdd,
  "git-worktree-add-failed": gitWorktreeAddFailed,
  "failed-tool-call": failedToolCall,
  "permission-allow": permissionAllow,
  "permission-deny": permissionDeny,
  interruption,
  "not-logged-in": notLoggedIn,
  "tool-interruption": toolInterruption,
  "plain-answer": plainAnswer,
  "question-answer": questionAnswer,
  "question-decline": questionDecline,
  "resumed-session": resumedSession,
  steer,
  thinking: thinking,
  "tool-call": toolCall,
}

const fixture = (name: keyof typeof fixtures): HarnessOutput[] =>
  fixtures[name]
    .split("\n")
    .filter((line) => line !== "")
    .flatMap(decodeClaudeLine)

const stored = (outputs: HarnessOutput[]) =>
  outputs.filter(
    (o) => o.type !== "delta" && o.type !== "provider_session" && o.type !== "task_output_file",
  )
const types = (outputs: HarnessOutput[]) => stored(outputs).map((o) => o.type)

test("a plain answer streams text deltas, then stores one assistant_text, usage and idle", () => {
  const outputs = fixture("plain-answer")

  expect(outputs.filter((o) => o.type === "delta")).toEqual([
    { type: "delta", kind: "assistant_text", text: "pong" },
  ])
  expect(types(outputs)).toEqual(["status", "assistant_text", "usage", "status"])
  expect(stored(outputs)[0]).toMatchObject({ type: "status", status: "running" })
  expect(stored(outputs)[1]).toMatchObject({ type: "assistant_text", text: "pong" })
  expect(stored(outputs)[3]).toMatchObject({ type: "status", status: "idle" })
})

test("the result line becomes a usage event with cache tokens and cost", () => {
  const usage = stored(fixture("plain-answer")).find((o) => o.type === "usage")

  expect(usage).toMatchObject({
    type: "usage",
    inputTokens: 2,
    outputTokens: 4,
    cacheReadTokens: 13661,
    cacheWriteTokens: 8080,
    costUsd: 0.0017548100000000003,
  })
})

test("thinking streams as deltas and is stored from the finished block", () => {
  const outputs = fixture("thinking")
  const thinking = stored(outputs).find((o) => o.type === "thinking")

  expect(outputs.some((o) => o.type === "delta" && o.kind === "thinking")).toBe(true)
  expect(thinking).toMatchObject({ type: "thinking" })
  expect(thinking && "text" in thinking && thinking.text).toContain("multiplying 17 by 23")
  expect(types(outputs).indexOf("thinking")).toBeLessThan(types(outputs).indexOf("assistant_text"))
})

test("a tool call and its result share a tool call id, and the raw payload is kept", () => {
  const events = stored(fixture("tool-call"))
  const call = events.find((o) => o.type === "tool_call")
  const result = events.find((o) => o.type === "tool_result")

  expect(call).toMatchObject({ type: "tool_call", name: "Read" })
  expect(call && "input" in call && call.input).toMatchObject({
    file_path: expect.stringContaining("note.txt"),
  })
  expect(result).toMatchObject({
    type: "tool_result",
    toolCallId: call && "toolCallId" in call ? call.toolCallId : "",
    output: "1\thello world\n2\t",
    isError: false,
  })
  expect(call?.raw).toMatchObject({ type: "tool_use", name: "Read" })
  expect(types(fixture("tool-call"))).toEqual([
    "status",
    "tool_call",
    "tool_result",
    "status",
    "assistant_text",
    "usage",
    "status",
  ])
})

test("a failed tool call gives a tool_result flagged as an error", () => {
  const result = stored(fixture("failed-tool-call")).find((o) => o.type === "tool_result")

  expect(result).toMatchObject({
    type: "tool_result",
    isError: true,
    output: expect.stringContaining("File does not exist"),
  })
})

test("tool result content given as blocks becomes one string", () => {
  const line = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "t1",
          content: [
            { type: "text", text: "a" },
            { type: "text", text: "b" },
          ],
        },
      ],
    },
  })

  expect(decodeClaudeLine(line)).toMatchObject([
    { type: "tool_result", toolCallId: "t1", output: "a\nb", isError: false },
  ])
})

test("an API error stores one error event, not the synthetic assistant text", () => {
  const outputs = fixture("api-error")

  expect(types(outputs)).toEqual(["status", "error", "usage", "status"])
  expect(stored(outputs)[1]).toMatchObject({
    type: "error",
    message: expect.stringContaining("selected model (nonsense)"),
  })
})

test("lines it does not handle, and text that is not JSON, produce nothing", () => {
  expect(decodeClaudeLine('{"type":"rate_limit_event"}')).toEqual([])
  expect(decodeClaudeLine('{"type":"system","subtype":"hook_started"}')).toEqual([])
  expect(decodeClaudeLine("not json")).toEqual([])
})

test("a handled line with an unexpected shape gives an error event", () => {
  expect(decodeClaudeLine('{"type":"assistant","message":{}}')).toMatchObject([{ type: "error" }])
})

test("a resumed run reports the provider session id and decodes the new turn", () => {
  const outputs = fixture("resumed-session")

  expect(outputs.filter((o) => o.type === "provider_session")).toEqual([
    { type: "provider_session", providerSessionId: "2c6e6b1f-9c18-49db-9cdb-6a97574180c9" },
  ])
  expect(types(outputs)).toEqual(["status", "assistant_text", "usage", "status"])
  expect(stored(outputs)[1]).toMatchObject({ type: "assistant_text", text: "walrus" })
})

test.each([
  ["permission-allow", false],
  ["permission-deny", true],
] as const)(
  "%s: the approval request sits between the tool call and its result",
  (name, isError) => {
    const events = stored(fixture(name))
    const call = events.find((o) => o.type === "tool_call")
    const request = events.find((o) => o.type === "approval_request")
    const result = events.find((o) => o.type === "tool_result")

    expect(call && request && result).toBeTruthy()
    expect(request).toMatchObject({
      type: "approval_request",
      requestId: expect.any(String),
      toolCallId: call && "toolCallId" in call ? call.toolCallId : null,
      name: "Bash",
    })
    expect(request && "input" in request ? request.input : null).toEqual(
      call && "input" in call ? call.input : undefined,
    )
    expect(result).toMatchObject({ isError })
    expect(
      types(
        events.filter((o) => ["tool_call", "approval_request", "tool_result"].includes(o.type)),
      ),
    ).toEqual(["tool_call", "approval_request", "tool_result"])
  },
)

test.each(["question-answer", "question-decline"] as const)(
  "%s: the agent's questions become a question request, not an approval request",
  (name) => {
    const events = stored(fixture(name))
    const call = events.find((o) => o.type === "tool_call")

    expect(events.some((o) => o.type === "approval_request")).toBe(false)
    expect(events.find((o) => o.type === "question_request")).toMatchObject({
      requestId: expect.any(String),
      toolCallId: call && "toolCallId" in call ? call.toolCallId : null,
      questions: [
        {
          question: "Which colour do you like?",
          header: "Colour",
          options: [
            { label: "Red", description: expect.any(String) },
            { label: "Blue", description: expect.any(String) },
          ],
          multiSelect: false,
        },
        {
          question: "Which fruits do you eat?",
          header: "Fruits",
          options: [{ label: "Apple" }, { label: "Pear" }, { label: "Plum" }],
          multiSelect: true,
        },
      ],
    })
  },
)

test("questions whose input does not read as questions stay an approval request", () => {
  const line = JSON.stringify({
    type: "control_request",
    request_id: "r1",
    request: {
      subtype: "can_use_tool",
      tool_name: "AskUserQuestion",
      input: { prompt: "?" },
      tool_use_id: "t1",
    },
  })

  expect(decodeClaudeLine(line)).toMatchObject([{ type: "approval_request", requestId: "r1" }])
})

test("a control request of another subtype is ignored", () => {
  const line = JSON.stringify({
    type: "control_request",
    request_id: "r1",
    request: { subtype: "hook_callback" },
  })

  expect(decodeClaudeLine(line)).toEqual([])
})

test("an interrupt during an answer becomes an interruption, not an error, then usage and idle", () => {
  const outputs = stored(fixture("interruption"))

  expect(outputs.filter((o) => o.type === "interruption")).toHaveLength(1)
  expect(outputs.some((o) => o.type === "error")).toBe(false)
  expect(types(outputs).slice(-2)).toEqual(["usage", "status"])
  expect(outputs.at(-1)).toMatchObject({ type: "status", status: "idle" })
  expect(outputs.find((o) => o.type === "interruption")).toMatchObject({
    raw: { message: { content: [{ text: "[Request interrupted by user]" }] } },
  })
})

test("an interrupt during a tool call becomes an interruption, not an error", () => {
  const outputs = stored(fixture("tool-interruption"))

  expect(outputs.filter((o) => o.type === "interruption")).toHaveLength(1)
  expect(outputs.some((o) => o.type === "error")).toBe(false)
  expect(outputs.at(-1)).toMatchObject({ type: "status", status: "idle" })
})

test("the control response to an interrupt is ignored", () => {
  const line = '{"type":"control_response","response":{"subtype":"success","request_id":"req-1"}}'

  expect(decodeClaudeLine(line)).toEqual([])
})

test("a logged-out claude becomes an error saying to log in", () => {
  const errors = stored(fixture("not-logged-in")).filter((o) => o.type === "error")

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ message: "Not logged in · Please run /login" })
})

const toolCallAndResult = (name: keyof typeof fixtures, tool: string) => {
  const events = stored(fixture(name))
  const call = events.find((o) => o.type === "tool_call" && o.name === tool)
  const result = events.find(
    (o) =>
      o.type === "tool_result" && call?.type === "tool_call" && o.toolCallId === call.toolCallId,
  )
  return { call, result }
}

test("EnterWorktree's result names the worktree the agent now works in", () => {
  const { call, result } = toolCallAndResult("enter-worktree", "EnterWorktree")

  expect(call).toMatchObject({ input: { name: "try-adopt" } })
  expect(result).toMatchObject({
    isError: false,
    output: expect.stringContaining("“/private/tmp/ivin-rec/repo/.claude/worktrees/try-adopt”"),
  })
})

test("ExitWorktree's result names the folder the agent is back in, last", () => {
  const { result } = toolCallAndResult("exit-worktree", "ExitWorktree")

  expect(result).toMatchObject({ isError: false })
  expect(result?.type === "tool_result" && result.output).toMatch(
    /Session is now back in “\/private\/tmp\/ivin-rec\/repo”\.$/,
  )
})

test("git worktree add through Bash is a Bash tool call whose command creates the worktree", () => {
  const { call, result } = toolCallAndResult("git-worktree-add", "Bash")

  expect(call).toMatchObject({
    input: { command: "git worktree add .worktrees/try-adopt -b try/adopt" },
  })
  expect(result).toMatchObject({ isError: false })
})

test("a git worktree add that fails gives a tool result flagged as an error", () => {
  const { result } = toolCallAndResult("git-worktree-add-failed", "Bash")

  expect(result).toMatchObject({
    isError: true,
    output: expect.stringContaining("a branch named 'try/adopt' already exists"),
  })
})

test("each message Claude Code takes from its queue is read, the first one and a steer after a tool result", () => {
  expect(fixture("steer").filter((o) => o.type !== "tool_result")).toEqual([
    { type: "message_read", messageId: "f1a639d5-fbff-480b-ae2b-102a23ba890b" },
    { type: "message_read", messageId: "c229e6e0-c4ef-494f-9f05-8a9c282d1666" },
  ])
})

test("a background command is a task from its start line to its notification, and the new turn follows", () => {
  const outputs = fixture("background-command")

  expect(outputs.filter((o) => o.type === "task_started")).toMatchObject([
    {
      type: "task_started",
      taskId: "baozjf0kj",
      toolCallId: "toolu_01TmfNJESh68WdPU9o3oFPYH",
      kind: "command",
      description: "Run sleep 4 then echo finished in background",
    },
  ])
  expect(outputs.filter((o) => o.type === "task_output_file")).toEqual([
    {
      type: "task_output_file",
      taskId: "baozjf0kj",
      path: expect.stringMatching(/\/tasks\/baozjf0kj\.output$/),
    },
  ])
  expect(outputs.filter((o) => o.type === "task_ended")).toMatchObject([
    {
      type: "task_ended",
      taskId: "baozjf0kj",
      outcome: "completed",
      summary:
        'Background command "Run sleep 4 then echo finished in background" completed (exit code 0)',
    },
  ])
  // The first turn ends idle while the task runs; Claude Code then starts its own turn once it ends.
  expect(types(outputs)).toEqual([
    "message_read",
    "status",
    "tool_call",
    "task_started",
    "tool_result",
    "status",
    "assistant_text",
    "usage",
    "status",
    "task_ended",
    "status",
    "assistant_text",
    "usage",
    "status",
  ])
  expect(stored(outputs).filter((o) => o.type === "status")).toMatchObject([
    { status: "running" },
    { status: "running" },
    { status: "idle" },
    { status: "running" },
    { status: "idle" },
  ])
})

test("a background subagent's steps carry the call that started it, its notification ends the task", () => {
  const outputs = fixture("background-agent")

  const started = outputs.find((o) => o.type === "task_started")
  expect(started).toMatchObject({
    taskId: "a0da5cb04d36f6df5",
    toolCallId: "toolu_01CBcuFGJ8gQnpufQ1P2aD3h",
    kind: "agent",
    description: "Count the files",
    prompt: expect.stringContaining("report how many entries it listed"),
  })
  const steps = outputs.filter(
    (o) => "parentToolCallId" in o && o.parentToolCallId === "toolu_01CBcuFGJ8gQnpufQ1P2aD3h",
  )
  expect(steps.map((o) => o.type)).toEqual(["tool_call", "tool_result", "assistant_text"])
  expect(steps[0]).toMatchObject({ name: "Bash", toolCallId: "toolu_012v2E8BqMzWiGnJGeqqve8o" })
  expect(outputs.find((o) => o.type === "task_ended")).toMatchObject({
    taskId: "a0da5cb04d36f6df5",
    outcome: "completed",
    summary: "`ls` listed 0 entries. The directory is empty, and the command printed nothing.",
  })
  // The main turn's own lines carry no parent.
  expect(
    outputs.filter(
      (o) => o.type === "assistant_text" && !("parentToolCallId" in o && o.parentToolCallId),
    ),
  ).toHaveLength(2)
})

test("a task ending with an unknown status counts as failed, one stopped as stopped", () => {
  const notification = (status: string) =>
    decodeClaudeLine(
      JSON.stringify({
        type: "system",
        subtype: "task_notification",
        task_id: "t1",
        tool_use_id: "toolu_1",
        status,
        output_file: "/tmp/t1.output",
        summary: "done",
      }),
    )

  expect(notification("stopped")).toMatchObject([{ type: "task_ended", outcome: "stopped" }])
  expect(notification("killed")).toMatchObject([{ type: "task_ended", outcome: "stopped" }])
  expect(notification("failed")).toMatchObject([{ type: "task_ended", outcome: "failed" }])
  expect(notification("whatever")).toMatchObject([{ type: "task_ended", outcome: "failed" }])
})

test("a subagent's SubagentHandback call is its assistant message under the call that started it", () => {
  const handback = (parent: string | null) =>
    decodeClaudeLine(
      JSON.stringify({
        type: "assistant",
        parent_tool_use_id: parent,
        message: {
          content: [
            { type: "tool_use", id: "h1", name: "SubagentHandback", input: { message: "Done." } },
          ],
        },
      }),
    )

  expect(handback("t1")).toMatchObject([
    { type: "assistant_text", text: "Done.", parentToolCallId: "t1" },
  ])
  expect(handback(null)).toMatchObject([{ type: "tool_call", name: "SubagentHandback" }])
})
