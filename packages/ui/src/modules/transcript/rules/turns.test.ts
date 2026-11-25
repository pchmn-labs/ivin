import type { ToolKind, TranscriptItem } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import {
  callPhrases,
  duration,
  lastTurnMessageId,
  pinnedCalls,
  shownRows,
  earlierSteps,
  stepOpenByDefault,
  transcriptRows,
  turnWork,
} from "./turns.ts"

let position = 0
const base = (id: string) => ({ id, sessionId: "s1", position: position++, at: position * 1000 })
const user = (id: string): TranscriptItem => ({
  ...base(id),
  type: "message",
  role: "user",
  text: id,
  images: [],
  steer: false,
})
const text = (id: string): TranscriptItem => ({
  ...base(id),
  type: "message",
  role: "assistant",
  text: id,
  images: [],
  steer: false,
})
const call = (
  id: string,
  kind: ToolKind = "command",
  status: "running" | "done" | "error" = "done",
): TranscriptItem => ({
  ...base(id),
  type: "tool_call",
  toolCallId: id,
  name: id,
  kind,
  input: {},
  status,
  output: null,
})
const usage = (id: string): TranscriptItem => ({
  ...base(id),
  type: "usage",
  inputTokens: 1,
  outputTokens: 1,
  costUsd: null,
})

test("a turn's work up to its last tool call is one row, and its answer rides in the same row", () => {
  const rows = transcriptRows([
    user("u1"),
    text("t1"),
    call("c1"),
    text("t2"),
    call("c2"),
    text("answer"),
    usage("usage"),
    user("u2"),
  ])

  expect(rows).toEqual([
    { type: "item", id: "u1" },
    {
      type: "work",
      id: "work:u1",
      itemIds: ["t1", "c1", "t2", "c2"],
      turnIds: ["u1", "t1", "c1", "t2", "c2", "answer", "usage"],
      answerIds: ["answer"],
    },
    { type: "item", id: "u2" },
    { type: "work", id: "work:u2", itemIds: [], turnIds: ["u2"], answerIds: [] },
  ])
})

test("while the last turn runs, its text after the last tool call heads a step, not the answer", () => {
  const rows = shownRows(
    transcriptRows([
      user("u1"),
      call("c0"),
      text("a1"),
      user("u2"),
      text("t1"),
      call("c1"),
      text("t2"),
    ]),
    true,
  )

  expect(rows).toEqual([
    { type: "item", id: "u1" },
    {
      type: "work",
      id: "work:u1",
      itemIds: ["c0"],
      turnIds: ["u1", "c0", "a1"],
      answerIds: ["a1"],
    },
    { type: "item", id: "u2" },
    {
      type: "work",
      id: "work:u2",
      itemIds: ["t1", "c1", "t2"],
      turnIds: ["u2", "t1", "c1", "t2"],
      answerIds: [],
    },
  ])
})

test("a running turn with no tool call yet has its text in its work row", () => {
  expect(shownRows(transcriptRows([user("u1"), text("t1")]), true)).toEqual([
    { type: "item", id: "u1" },
    { type: "work", id: "work:u1", itemIds: ["t1"], turnIds: ["u1", "t1"], answerIds: [] },
  ])
})

test("a transcript with no work row is left as it is while running", () => {
  const rows = transcriptRows([text("a1")])
  expect(shownRows(rows, true)).toBe(rows)
})

test("a turn with no tool call keeps its answer in its work row once the next turn starts", () => {
  const rows = transcriptRows([user("u1"), text("hi"), user("u2")])

  expect(rows.map((row) => row.id)).toEqual(["u1", "work:u1", "u2", "work:u2"])
  expect(rows[1]).toMatchObject({ answerIds: ["hi"] })
  expect(shownRows(rows, false).map((row) => row.id)).toEqual(["u1", "work:u1", "u2"])
})

test("items before the first user message are a turn cut by paging", () => {
  expect(transcriptRows([call("c1"), text("answer")])).toEqual([
    {
      type: "work",
      id: "work:c1",
      itemIds: ["c1"],
      turnIds: ["c1", "answer"],
      answerIds: ["answer"],
    },
  ])
})

test("each sentence starts a step, and calls before any sentence form a first step", () => {
  const items = [user("u"), call("c0"), text("t1"), call("c1", "read", "error"), call("c2")]
  const work = turnWork("w", items.slice(1), items)

  expect(work.steps.map((step) => [step.id, step.sentence?.id ?? null, step.failed])).toEqual([
    ["w:start", null, 0],
    ["t1", "t1", 1],
  ])
  expect(work).toMatchObject({ calls: 3, failed: 1, outcome: "silent" })
})

test("the turn is timed from its first item to its last", () => {
  const items = [user("u"), call("c"), text("a"), usage("x")]
  const work = turnWork("w", items.slice(1, 2), items)

  expect(work.endAt - work.startAt).toBe(3000)
  expect(work.outcome).toBe("answered")
})

test("a turn without an answer is stopped when interrupted and failed on an error", () => {
  const interrupted: TranscriptItem = { ...base("i"), type: "interruption" }
  const error: TranscriptItem = { ...base("e"), type: "error", message: "boom" }

  expect(turnWork("w", [call("c")], [user("u"), call("c"), interrupted]).outcome).toBe("stopped")
  expect(turnWork("w", [call("c")], [user("u"), call("c"), error]).outcome).toBe("failed")
})

test("while the turn runs only its last step is open; once it ends every step is, up to 8 calls", () => {
  const work = turnWork("w", [text("t1"), call("c1"), text("t2"), call("c2")], [])

  expect(work.steps.map((_, index) => stepOpenByDefault(work, index, true))).toEqual([false, true])
  expect(work.steps.map((_, index) => stepOpenByDefault(work, index, false))).toEqual([true, true])
})

test("while the turn runs, the steps before its last 3 are earlier steps; once it ends, none are", () => {
  const work = turnWork(
    "w",
    ["t1", "t2", "t3", "t4", "t5"].flatMap((id) => [text(id), call(`c${id}`)]),
    [],
  )

  expect(earlierSteps(work, true).map((step) => step.id)).toEqual(["t1", "t2"])
  expect(earlierSteps(work, false)).toEqual([])
  expect(earlierSteps({ ...work, steps: work.steps.slice(2) }, true)).toEqual([])
})

test("a finished turn of more than 8 calls opens its steps folded", () => {
  const calls = Array.from({ length: 9 }, (_, index) => call(`c${index}`))
  const work = turnWork("w", [text("t1"), ...calls.slice(0, 4), text("t2"), ...calls.slice(4)], [])

  expect(work.steps.map((_, index) => stepOpenByDefault(work, index, false))).toEqual([
    false,
    false,
  ])
})

test("a folded step keeps its failed calls and its subagent calls", () => {
  const [step] = turnWork(
    "w",
    [call("a"), call("b", "agent"), call("c", "read", "error")],
    [],
  ).steps

  expect(pinnedCalls(step!).map((c) => c.id)).toEqual(["b", "c"])
})

test("a step's calls read as one phrase per kind, in the order they first appear", () => {
  const kinds: ToolKind[] = ["command", "read", "command", "command", "search", "other", "command"]

  expect(callPhrases(kinds.map((kind) => ({ kind })))).toEqual([
    "Ran 4 commands",
    "read 1 file",
    "searched",
    "used a tool",
  ])
  expect(callPhrases([{ kind: "agent" }, { kind: "edit" }, { kind: "edit" }])).toEqual([
    "Ran an agent",
    "edited 2 files",
  ])
})

test("a duration reads in seconds, then minutes and seconds", () => {
  expect([duration(12_400), duration(102_000)]).toEqual(["12s", "1m 42s"])
})

test("the last turn's message is the user message that opens it", () => {
  expect(lastTurnMessageId(transcriptRows([user("u1"), text("a1"), user("u2")]))).toBe("u2")
  expect(lastTurnMessageId(transcriptRows([user("u1"), call("c1"), text("a1")]))).toBe("u1")
})

test("a last turn cut by paging has no message", () => {
  expect(lastTurnMessageId(transcriptRows([text("t1"), call("c1"), text("a1")]))).toBeUndefined()
  expect(lastTurnMessageId(transcriptRows([text("a1")]))).toBeUndefined()
})

const steer = (id: string): TranscriptItem => ({ ...user(id), steer: true }) as TranscriptItem

test("a steer stays in the running turn's work, and only a message that starts a turn opens a new one", () => {
  const rows = transcriptRows([
    user("u1"),
    call("c1"),
    steer("s1"),
    steer("s2"),
    text("answer"),
    user("u2"),
  ])

  expect(rows).toEqual([
    { type: "item", id: "u1" },
    {
      type: "work",
      id: "work:u1",
      itemIds: ["c1", "s1", "s2"],
      turnIds: ["u1", "c1", "s1", "s2", "answer"],
      answerIds: ["answer"],
    },
    { type: "item", id: "u2" },
    { type: "work", id: "work:u2", itemIds: [], turnIds: ["u2"], answerIds: [] },
  ])
  expect(lastTurnMessageId(rows.slice(0, 2))).toBe("u1")
})

test("a steer opens a step, and the sentence the agent writes next heads that step", () => {
  const items = [user("u"), call("c0"), steer("s1"), text("t1"), call("c1"), steer("s2")]
  const work = turnWork("w", items.slice(1), items)

  expect(
    work.steps.map((step) => [step.id, step.steer?.id ?? null, step.sentence?.id ?? null]),
  ).toEqual([
    ["w:start", null, null],
    ["s1", "s1", "t1"],
    ["s2", "s2", null],
  ])
  expect(work.calls).toBe(2)
})

test("a turn whose steers come after its last call still times every item", () => {
  const items = [user("u"), call("c"), steer("s"), text("a")]
  const work = turnWork("w", items.slice(1, 3), items)

  expect(work.endAt - work.startAt).toBe(3000)
  expect(work.outcome).toBe("answered")
})

const question = (id: string, toolCallId: string): TranscriptItem => ({
  ...base(id),
  type: "question",
  requestId: id,
  toolCallId,
  questions: [],
  status: "answered",
  answers: [],
})

test("the agent's questions replace the tool call that asked them, in the turn's answer", () => {
  const items = [user("u"), text("t1"), call("ask", "other"), question("q", "ask"), text("t2")]

  const rows = transcriptRows(items)

  expect(rows.map((row) => row.id)).toEqual(["u", "work:u"])
  expect(rows[1]).toMatchObject({ answerIds: ["t1", "q", "t2"] })
})

test("questions asked before the turn's last tool call stay in its work, as a step's child", () => {
  const items = [user("u"), text("t1"), call("ask", "other"), question("q", "ask"), call("c1")]
  const rows = transcriptRows(items)
  const work = rows.at(-1)
  const ids = work?.type === "work" ? work.itemIds : []

  expect(ids).toEqual(["t1", "q", "c1"])
  expect(
    turnWork(
      "w",
      items.filter((item) => ids.includes(item.id)),
      items,
    ).steps[0]!.children.map((child) => child.id),
  ).toEqual(["q", "c1"])
})

test("a task and a subagent's steps are no part of the turns", () => {
  const items: TranscriptItem[] = [
    user("u1"),
    call("c1", "agent"),
    {
      ...base("task"),
      type: "task",
      taskId: "k1",
      toolCallId: "c1",
      kind: "agent",
      description: "Review",
      status: "running",
      summary: null,
      output: null,
    },
    { ...(call("step", "command") as object), parentToolCallId: "c1" } as TranscriptItem,
    { ...(text("step-text") as object), parentToolCallId: "c1" } as TranscriptItem,
    text("answer"),
  ]

  const shown = new Set(
    transcriptRows(items).flatMap((row) => (row.type === "work" ? row.turnIds : [row.id])),
  )

  expect(shown).toEqual(new Set(["u1", "c1", "answer"]))
})
