import type { HarnessOutput } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { decodeClaudeLine } from "./decode-claude-line.ts"
import apiError from "./fixtures/api-error.jsonl?raw"
import failedToolCall from "./fixtures/failed-tool-call.jsonl?raw"
import permissionAllow from "./fixtures/permission-allow.jsonl?raw"
import permissionDeny from "./fixtures/permission-deny.jsonl?raw"
import plainAnswer from "./fixtures/plain-answer.jsonl?raw"
import resumedSession from "./fixtures/resumed-session.jsonl?raw"
import thinking from "./fixtures/thinking.jsonl?raw"
import toolCall from "./fixtures/tool-call.jsonl?raw"

const fixtures = {
  "api-error": apiError,
  "failed-tool-call": failedToolCall,
  "permission-allow": permissionAllow,
  "permission-deny": permissionDeny,
  "plain-answer": plainAnswer,
  "resumed-session": resumedSession,
  thinking: thinking,
  "tool-call": toolCall,
}

const fixture = (name: keyof typeof fixtures): HarnessOutput[] =>
  fixtures[name]
    .split("\n")
    .filter((line) => line !== "")
    .flatMap(decodeClaudeLine)

const stored = (outputs: HarnessOutput[]) =>
  outputs.filter((o) => o.type !== "delta" && o.type !== "provider_session")
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

test("a control request of another subtype is ignored", () => {
  const line = JSON.stringify({
    type: "control_request",
    request_id: "r1",
    request: { subtype: "hook_callback" },
  })

  expect(decodeClaudeLine(line)).toEqual([])
})
