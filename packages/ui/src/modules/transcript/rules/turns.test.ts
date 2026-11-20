import type { ToolKind, TranscriptItem } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import {
  callPhrases,
  duration,
  pinnedCalls,
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
})
const text = (id: string): TranscriptItem => ({
  ...base(id),
  type: "message",
  role: "assistant",
  text: id,
  images: [],
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

test("a turn's work up to its last tool call is one row, and its answer stays a row after it", () => {
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
    },
    { type: "item", id: "answer" },
    { type: "item", id: "u2" },
    { type: "work", id: "work:u2", itemIds: [], turnIds: ["u2"] },
  ])
})

test("an earlier turn with no tool call has no work row", () => {
  expect(transcriptRows([user("u1"), text("hi"), user("u2")]).map((row) => row.id)).toEqual([
    "u1",
    "hi",
    "u2",
    "work:u2",
  ])
})

test("items before the first user message are a turn cut by paging", () => {
  expect(transcriptRows([call("c1"), text("answer")])).toEqual([
    { type: "work", id: "work:c1", itemIds: ["c1"], turnIds: ["c1", "answer"] },
    { type: "item", id: "answer" },
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
