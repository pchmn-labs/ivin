import type { TranscriptEvent } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { applyEvent, deriveItems, emptyItemState } from "./derive-items.ts"

type Body = Record<string, unknown> & { type: TranscriptEvent["type"] }

const events = (...bodies: Body[]): TranscriptEvent[] =>
  bodies.map(
    (body, index) =>
      ({
        id: `e${index + 1}`,
        sessionId: "s1",
        sequence: index + 1,
        at: null,
        raw: null,
        ...body,
      }) as unknown as TranscriptEvent,
  )

const user = (text: string): Body => ({ type: "user_message", text })
const assistant = (text: string): Body => ({ type: "assistant_text", text })
const call = (toolCallId: string): Body => ({
  type: "tool_call",
  toolCallId,
  name: "list_files",
  input: { path: "." },
})
const result = (toolCallId: string, isError = false): Body => ({
  type: "tool_result",
  toolCallId,
  output: "out",
  isError,
})

test("a user message is one message item named after its event", () => {
  expect(deriveItems(events(user("hi")))).toEqual([
    { id: "e1", sessionId: "s1", position: 1, type: "message", role: "user", text: "hi" },
  ])
})

test("consecutive assistant texts assemble into one message at the first event's position", () => {
  const items = deriveItems(events(user("hi"), assistant("one"), assistant("two")))

  expect(items).toHaveLength(2)
  expect(items[1]).toMatchObject({ id: "e2", position: 2, role: "assistant", text: "one\n\ntwo" })
})

test("assistant texts split by a tool call stay two messages", () => {
  const items = deriveItems(
    events(assistant("before"), call("t1"), result("t1"), assistant("after")),
  )

  expect(items.map((item) => item.type)).toEqual(["message", "tool_call", "message"])
})

test("a user message or an idle status ends the open assistant message", () => {
  const items = deriveItems(
    events(
      assistant("a"),
      user("next"),
      assistant("b"),
      { type: "status", status: "idle" },
      assistant("c"),
    ),
  )

  expect(items.filter((item) => item.type === "message" && item.role === "assistant")).toHaveLength(
    3,
  )
})

test("a tool call and its result are one item with the output and a done status", () => {
  const items = deriveItems(events(call("t1"), result("t1")))

  expect(items).toEqual([
    {
      id: "e1",
      sessionId: "s1",
      position: 1,
      type: "tool_call",
      toolCallId: "t1",
      name: "list_files",
      input: { path: "." },
      status: "done",
      output: "out",
    },
  ])
})

test("a tool call without a result is running, and a failed result makes it an error", () => {
  expect(deriveItems(events(call("t1")))[0]).toMatchObject({ status: "running", output: null })
  expect(deriveItems(events(call("t1"), result("t1", true)))[0]).toMatchObject({ status: "error" })
})

test("results of parallel tool calls match their own call", () => {
  const items = deriveItems(events(call("a"), call("b"), result("b"), result("a", true)))

  expect(items).toMatchObject([
    { toolCallId: "a", status: "error" },
    { toolCallId: "b", status: "done" },
  ])
})

test("a result with no call and a status event produce no item", () => {
  expect(deriveItems(events(result("ghost"), { type: "status", status: "running" }))).toEqual([])
})

test("applyEvent gives the changed item for each event, so a watcher sees one upsert per event", () => {
  const [first, second] = events(call("t1"), result("t1"))
  const a = applyEvent(emptyItemState, first!)
  const b = applyEvent(a.state, second!)

  expect(a.item).toMatchObject({ id: "e1", status: "running" })
  expect(b.item).toMatchObject({ id: "e1", status: "done" })
})

test("a usage event is a usage item at its own position and leaves the open message alone", () => {
  const usage: Body = {
    type: "usage",
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0.01,
  }
  const items = deriveItems(events(assistant("one"), usage, assistant("two")))

  expect(items).toEqual([
    {
      id: "e1",
      sessionId: "s1",
      position: 1,
      type: "message",
      role: "assistant",
      text: "one\n\ntwo",
    },
    {
      id: "e2",
      sessionId: "s1",
      position: 2,
      type: "usage",
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.01,
    },
  ])
})

test("an error event is an error item", () => {
  expect(deriveItems(events(user("hi"), { type: "error", message: "boom" }))[1]).toEqual({
    id: "e2",
    sessionId: "s1",
    position: 2,
    type: "error",
    message: "boom",
  })
})

const request = (requestId: string): Body => ({
  type: "approval_request",
  requestId,
  toolCallId: "t1",
  name: "Bash",
  input: { command: "ls" },
})
const decision = (requestId: string, allow: boolean): Body => ({
  type: "approval_decision",
  requestId,
  allow,
})

test("an approval request is an approval item with no decision yet", () => {
  expect(deriveItems(events(request("r1")))).toEqual([
    {
      id: "e1",
      sessionId: "s1",
      position: 1,
      type: "approval",
      requestId: "r1",
      toolCallId: "t1",
      name: "Bash",
      input: { command: "ls" },
      decision: null,
    },
  ])
})

test("a decision fills the decision of its own request, in place", () => {
  const items = deriveItems(
    events(request("r1"), request("r2"), decision("r2", false), decision("r1", true)),
  )

  expect(items).toMatchObject([
    { id: "e1", position: 1, decision: "allow" },
    { id: "e2", position: 2, decision: "deny" },
  ])
})

test("a decision with no request, and any status, produce no item", () => {
  expect(
    deriveItems(
      events(decision("ghost", true), { type: "status", status: "waiting_for_approval" }),
    ),
  ).toEqual([])
})
