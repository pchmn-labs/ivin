import type { TranscriptEvent } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import {
  applyEvent,
  emptyItemState,
  replay,
  stoppedTaskEvents,
  unansweredEvents,
} from "./derive-items.ts"

const kindOf = (name: string) => (name === "list_files" ? "search" : "other")
const derive = (all: TranscriptEvent[]) => replay(all, kindOf).items

type Body = Record<string, unknown> & { type: TranscriptEvent["type"] }

const events = (...bodies: Body[]): TranscriptEvent[] =>
  bodies.map(
    (body, index) =>
      ({
        id: `e${index + 1}`,
        sessionId: "s1",
        sequence: index + 1,
        at: { epochMilliseconds: (index + 1) * 1000 },
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
  expect(derive(events(user("hi")))).toEqual([
    {
      id: "e1",
      sessionId: "s1",
      position: 1,
      at: 1000,
      type: "message",
      role: "user",
      text: "hi",
      images: [],
      steer: false,
    },
  ])
})

test("a user message read while a turn ran is a steer", () => {
  expect(derive(events({ type: "user_message", text: "also", steer: true }))).toMatchObject([
    { type: "message", role: "user", steer: true },
  ])
})

test("consecutive assistant texts assemble into one message at the first event's position", () => {
  const items = derive(events(user("hi"), assistant("one"), assistant("two")))

  expect(items).toHaveLength(2)
  expect(items[1]).toMatchObject({ id: "e2", position: 2, role: "assistant", text: "one\n\ntwo" })
})

test("assistant texts split by a tool call stay two messages", () => {
  const items = derive(events(assistant("before"), call("t1"), result("t1"), assistant("after")))

  expect(items.map((item) => item.type)).toEqual(["message", "tool_call", "message"])
})

test("a user message or an idle status ends the open assistant message", () => {
  const items = derive(
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

test("a tool call and its result are one item with its kind, the output and a done status", () => {
  const items = derive(events(call("t1"), result("t1")))

  expect(items).toEqual([
    {
      id: "e1",
      sessionId: "s1",
      position: 1,
      at: 1000,
      type: "tool_call",
      toolCallId: "t1",
      name: "list_files",
      kind: "search",
      input: { path: "." },
      status: "done",
      output: "out",
    },
  ])
})

test("a tool call without a result is running, and a failed result makes it an error", () => {
  expect(derive(events(call("t1")))[0]).toMatchObject({ status: "running", output: null })
  expect(derive(events(call("t1"), result("t1", true)))[0]).toMatchObject({ status: "error" })
})

test("results of parallel tool calls match their own call", () => {
  const items = derive(events(call("a"), call("b"), result("b"), result("a", true)))

  expect(items).toMatchObject([
    { toolCallId: "a", status: "error" },
    { toolCallId: "b", status: "done" },
  ])
})

test("a result with no call and a status event produce no item", () => {
  expect(derive(events(result("ghost"), { type: "status", status: "running" }))).toEqual([])
})

test("applyEvent gives the changed item for each event, so a watcher sees one upsert per event", () => {
  const [first, second] = events(call("t1"), result("t1"))
  const a = applyEvent(emptyItemState, first!, kindOf)
  const b = applyEvent(a.state, second!, kindOf)

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
  const items = derive(events(assistant("one"), usage, assistant("two")))

  expect(items).toEqual([
    {
      id: "e1",
      sessionId: "s1",
      position: 1,
      at: 1000,
      type: "message",
      role: "assistant",
      text: "one\n\ntwo",
      images: [],
      steer: false,
    },
    {
      id: "e2",
      sessionId: "s1",
      position: 2,
      at: 2000,
      type: "usage",
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.01,
    },
  ])
})

test("an error event is an error item", () => {
  expect(derive(events(user("hi"), { type: "error", message: "boom" }))[1]).toEqual({
    id: "e2",
    sessionId: "s1",
    position: 2,
    at: 2000,
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
  expect(derive(events(request("r1")))).toEqual([
    {
      id: "e1",
      sessionId: "s1",
      position: 1,
      at: 1000,
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
  const items = derive(
    events(request("r1"), request("r2"), decision("r2", false), decision("r1", true)),
  )

  expect(items).toMatchObject([
    { id: "e1", position: 1, decision: "allow" },
    { id: "e2", position: 2, decision: "deny" },
  ])
})

test("a decision with no request, and any status, produce no item", () => {
  expect(
    derive(events(decision("ghost", true), { type: "status", status: "waiting_for_approval" })),
  ).toEqual([])
})

const questions = [{ question: "Which?", header: "Pick", options: [], multiSelect: false }]
const asked = (requestId: string): Body => ({
  type: "question_request",
  requestId,
  toolCallId: "t1",
  questions,
})
const answered = (requestId: string, answers: unknown): Body => ({
  type: "question_answer",
  requestId,
  answers,
})

test("a question request is an open question item, and its answers fill it in place", () => {
  const answers = [{ question: "Which?", choices: ["A"] }]

  expect(derive(events(asked("q1")))).toMatchObject([
    { id: "e1", type: "question", requestId: "q1", questions, status: "open", answers: [] },
  ])
  expect(derive(events(asked("q1"), answered("q1", answers)))).toMatchObject([
    { id: "e1", status: "answered", answers },
  ])
  expect(derive(events(asked("q1"), answered("q1", null)))).toMatchObject([
    { id: "e1", status: "declined", answers: [] },
  ])
})

test("an approval decision does not close a question, nor an answer an approval", () => {
  const items = derive(
    events(asked("q1"), request("r1"), decision("q1", true), answered("r1", null)),
  )

  expect(items).toMatchObject([
    { type: "question", status: "open" },
    { type: "approval", decision: null },
  ])
})

test("an unanswered request closes its approval or question in place, and only an open one", () => {
  const unanswered = (requestId: string): Body => ({ type: "request_unanswered", requestId })
  const { items, state } = replay(
    events(request("r1"), asked("q1"), unanswered("r1"), unanswered("q1"), unanswered("r1")),
    kindOf,
  )

  expect(items).toMatchObject([
    { id: "e1", type: "approval", decision: "unanswered" },
    { id: "e2", type: "question", status: "unanswered" },
  ])
  expect(state.openRequests.size).toBe(0)
})

test("closing open requests fails the running tool call each approval was for, and only that one", () => {
  const { state } = replay(
    events(
      call("t1"),
      { ...request("r1"), toolCallId: "t1" },
      call("t2"),
      result("t2"),
      { ...request("r2"), toolCallId: "t2" },
      asked("q1"),
    ),
    kindOf,
  )

  expect(unansweredEvents(state)).toEqual([
    { type: "request_unanswered", requestId: "r1", raw: null },
    {
      type: "tool_result",
      toolCallId: "t1",
      output: "Not run: the approval was not answered.",
      isError: true,
      raw: null,
    },
    { type: "request_unanswered", requestId: "r2", raw: null },
    { type: "request_unanswered", requestId: "q1", raw: null },
  ])
})

test("replaying from a state carried over gives the items replaying every event gives", () => {
  const all = events(
    user("hi"),
    assistant("one"),
    call("t1"),
    request("r1"),
    {
      type: "usage",
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: null,
    },
    assistant("two"),
    assistant("three"),
    result("t1"),
    decision("r1", true),
  )
  const head = replay(all.slice(0, 6), kindOf)
  const tail = replay(all.slice(6), kindOf, head.state)
  const merged = new Map([...head.items, ...tail.items].map((item) => [item.id, item]))

  expect([...merged.values()]).toEqual(derive(all))
})

test("an interruption is its own item and closes the open assistant message", () => {
  const items = derive(
    events(user("hi"), assistant("one"), { type: "interruption" }, assistant("two")),
  )

  expect(items.map((i) => i.type)).toEqual(["message", "message", "interruption", "message"])
  expect(items[2]).toEqual({
    id: "e3",
    sessionId: "s1",
    position: 3,
    at: 3000,
    type: "interruption",
  })
  expect(items[3]).toMatchObject({ text: "two" })
})

const taskStarted = (taskId = "k1", toolCallId = "t1"): Body => ({
  type: "task_started",
  taskId,
  toolCallId,
  kind: "agent",
  description: "Review the diff",
})
const taskEnded = (taskId = "k1", outcome = "completed"): Body => ({
  type: "task_ended",
  taskId,
  outcome,
  summary: "done",
  output: null,
})

test("a task is one item that runs from its start and ends with its notification", () => {
  const items = derive(events(call("t1"), taskStarted(), result("t1"), taskEnded()))

  expect(items.map((item) => item.type)).toEqual(["tool_call", "task"])
  expect(items[1]).toMatchObject({
    id: "e2",
    position: 2,
    taskId: "k1",
    toolCallId: "t1",
    status: "completed",
    summary: "done",
  })
})

test("a task is open from its start to its end", () => {
  const started = replay(events(taskStarted()), kindOf).state
  const ended = replay(events(taskStarted(), taskEnded("k1", "failed")), kindOf).state

  expect([...started.openTasks.keys()]).toEqual(["k1"])
  expect(ended.openTasks.size).toBe(0)
})

test("the end of a task never started changes nothing", () => {
  expect(derive(events(taskEnded("unknown")))).toEqual([])
})

test("a subagent's steps are items under their call, and leave the agent's own message open", () => {
  const items = derive(
    events(
      assistant("working on it"),
      { ...call("s1"), parentToolCallId: "t1" },
      { ...result("s1"), parentToolCallId: "t1" },
      { ...assistant("report"), parentToolCallId: "t1" },
      assistant("and more"),
    ),
  )

  expect(
    items.map((item) => [item.type, "parentToolCallId" in item && item.parentToolCallId]),
  ).toEqual([
    ["message", false],
    ["tool_call", "t1"],
    ["message", "t1"],
  ])
  expect(items[0]).toMatchObject({ text: "working on it\n\nand more" })
  expect(items[1]).toMatchObject({ status: "done", output: "out" })
})

test("stopping the run ends each open task and fails the calls its subagent left running", () => {
  const { state } = replay(events(taskStarted(), { ...call("s1"), parentToolCallId: "t1" }), kindOf)

  expect(stoppedTaskEvents(state)).toMatchObject([
    { type: "tool_result", toolCallId: "s1", isError: true, parentToolCallId: "t1" },
    { type: "task_ended", taskId: "k1", outcome: "stopped" },
  ])
})
