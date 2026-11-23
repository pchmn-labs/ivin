import { expect, test, vi } from "vitest"
import { AsyncResult } from "effect/reactivity"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { PAGE_SIZE, transcriptOf } from "./get-items.ts"
import { usageOf } from "./get-usage.ts"
import { loadItemsBeforeAtom } from "./load-items-before.ts"
import { trimTranscriptAtom } from "./trim-transcript.ts"

const usage = (position: number): TranscriptItem => ({
  id: `u${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "usage",
  inputTokens: 10,
  outputTokens: 5,
  costUsd: 0.5,
})

const total = (registry: ReturnType<typeof makeTestRegistry>["registry"]) => {
  const result = registry.get(usageOf("s1"))
  return AsyncResult.isSuccess(result) ? result.value : "waiting"
}

test("the usage total covers the whole session, loaded or not, and survives dropping older pages", async () => {
  const { registry, server } = makeTestRegistry()
  registry.mount(sessionsOf("/p").ids)
  server.seedItems(
    "s1",
    Array.from({ length: PAGE_SIZE * 3 }, (_, i) => usage(i)),
  )
  const transcript = transcriptOf("s1")
  registry.mount(transcript.view)
  registry.mount(usageOf("s1"))
  registry.mount(trimTranscriptAtom)
  registry.mount(loadItemsBeforeAtom)

  await vi.waitFor(() =>
    expect(total(registry)).toEqual({ tokens: 15 * PAGE_SIZE * 3, costUsd: 75 }),
  )
  const everything = { tokens: 15 * PAGE_SIZE * 3, costUsd: 75 }
  const loaded = () => registry.get(transcript.list.ids).length

  registry.set(loadItemsBeforeAtom, "s1")
  await vi.waitFor(() => expect(loaded()).toBe(PAGE_SIZE * 2))
  expect(total(registry)).toEqual(everything)
  registry.set(trimTranscriptAtom, "s1")
  await vi.waitFor(() => expect(loaded()).toBe(PAGE_SIZE))
  expect(total(registry)).toEqual(everything)

  server.pushItem(usage(PAGE_SIZE * 3))
  await vi.waitFor(() =>
    expect(total(registry)).toEqual({ tokens: 15 * (PAGE_SIZE * 3 + 1), costUsd: 75.5 }),
  )
})
