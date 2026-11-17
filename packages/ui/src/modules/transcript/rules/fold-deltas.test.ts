import { expect, test } from "vitest"
import type { TranscriptDelta, TranscriptItem } from "@ivin/contracts/transcript"
import { foldDeltas } from "./fold-deltas.ts"

const delta = (
  itemId: string,
  text: string,
  kind: TranscriptDelta["kind"] = "message",
): TranscriptDelta => ({
  type: "delta",
  sessionId: "s1",
  itemId,
  position: 3,
  kind,
  text,
})

test("deltas for an unknown item create it at the delta's position", () => {
  const items = foldDeltas(() => undefined, [delta("a", "Hel"), delta("a", "lo")])
  expect(items).toEqual([
    { id: "a", sessionId: "s1", position: 3, type: "message", role: "assistant", text: "Hello" },
  ])
})

test("deltas append to the item already held", () => {
  const held: TranscriptItem = {
    id: "a",
    sessionId: "s1",
    position: 3,
    type: "thinking",
    text: "Hm",
  }
  const items = foldDeltas(
    (id) => (id === "a" ? held : undefined),
    [delta("a", "m,", "thinking"), delta("b", "x", "thinking")],
  )
  expect(items).toMatchObject([
    { id: "a", type: "thinking", text: "Hmm," },
    { id: "b", type: "thinking", text: "x" },
  ])
})
