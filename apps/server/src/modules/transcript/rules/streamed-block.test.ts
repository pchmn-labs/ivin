import type { HarnessDelta } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { emptyItemState, type ItemState } from "./derive-items.ts"
import { applyDelta, blockAfterEvent, finishedEventId } from "./streamed-block.ts"

const text = (value: string): HarnessDelta => ({
  type: "delta",
  kind: "assistant_text",
  text: value,
})
const thinking = (value: string): HarnessDelta => ({ type: "delta", kind: "thinking", text: value })

test("the first delta reserves an id at the next position, and later deltas keep it", () => {
  const first = applyDelta(null, emptyItemState, 4, text("Hel"), () => "new")
  expect(first.change).toEqual({ itemId: "new", position: 5, kind: "message", text: "Hel" })
  const second = applyDelta(first.block, emptyItemState, 4, text("lo"), () => "other")
  expect(second.change).toEqual({ itemId: "new", position: 5, kind: "message", text: "lo" })
})

test("thinking deltas target a thinking item", () => {
  const { change } = applyDelta(null, emptyItemState, 0, thinking("hm"), () => "t")
  expect(change).toEqual({ itemId: "t", position: 1, kind: "thinking", text: "hm" })
})

const openMessage: ItemState = {
  openToolCalls: new Map(),
  openMessage: {
    id: "m",
    sessionId: "s",
    position: 3,
    type: "message",
    role: "assistant",
    text: "a",
  },
}

test("a text delta after an open assistant message targets it, joined by a blank line", () => {
  const first = applyDelta(null, openMessage, 7, text("b"), () => "new")
  expect(first.change).toEqual({ itemId: "m", position: 3, kind: "message", text: "\n\nb" })
  const second = applyDelta(first.block, openMessage, 7, text("c"), () => "new")
  expect(second.change.text).toBe("c")
})

test("a thinking delta never targets the open message", () => {
  expect(applyDelta(null, openMessage, 7, thinking("x"), () => "t").change.itemId).toBe("t")
})

test("the finished block is stored under the reserved id only when it created the item", () => {
  const fresh = applyDelta(null, emptyItemState, 0, text("a"), () => "new").block
  const joined = applyDelta(null, openMessage, 7, text("a"), () => "new").block
  expect(finishedEventId(fresh, "assistant_text")).toBe("new")
  expect(finishedEventId(joined, "assistant_text")).toBeUndefined()
  expect(finishedEventId(fresh, "thinking")).toBeUndefined()
  expect(finishedEventId(null, "assistant_text")).toBeUndefined()
})

test("status and usage leave the block open, any item-producing event closes it", () => {
  const block = applyDelta(null, emptyItemState, 0, text("a"), () => "new").block
  const raw = { raw: null }
  expect(blockAfterEvent(block, { type: "status", status: "running", ...raw })).toBe(block)
  expect(
    blockAfterEvent(block, {
      type: "usage",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: null,
      ...raw,
    }),
  ).toBe(block)
  expect(
    blockAfterEvent(block, { type: "tool_call", toolCallId: "t", name: "n", input: {}, ...raw }),
  ).toBeNull()
  expect(blockAfterEvent(block, { type: "assistant_text", text: "a", ...raw })).toBeNull()
})
