import { Effect } from "effect"
import { AtomRegistry } from "effect/reactivity"
import { expect, test, vi } from "vitest"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { PAGE_SIZE, transcriptOf } from "./get-items.ts"
import { loadItemsBeforeAtom } from "./load-items-before.ts"
import { trimTranscriptAtom } from "./trim-transcript.ts"

const message = (position: number): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "message",
  role: "assistant",
  text: `message ${position}`,
  images: [],
  steer: false,
})

const setup = async (count: number) => {
  const { registry, server } = makeTestRegistry()
  registry.mount(sessionsOf("/p").ids)
  server.seedItems(
    "s1",
    Array.from({ length: count }, (_, i) => message(i)),
  )
  const transcript = transcriptOf("s1")
  registry.mount(transcript.view)
  registry.mount(loadItemsBeforeAtom)
  registry.mount(trimTranscriptAtom)
  await vi.waitFor(() => expect(registry.get(transcript.view).loaded).toBe(true))
  const ids = () => registry.get(transcript.list.ids)
  return { registry, transcript, ids }
}

test("trimming a transcript loaded back three pages keeps its last page and lets older pages load again", async () => {
  const { registry, transcript, ids } = await setup(PAGE_SIZE * 3)
  for (let page = 2; page <= 3; page++) {
    registry.set(loadItemsBeforeAtom, "s1")
    await vi.waitFor(() => expect(ids()).toHaveLength(PAGE_SIZE * page))
  }
  expect(registry.get(transcript.paging).hasBefore).toBe(false)

  registry.set(trimTranscriptAtom, "s1")
  await vi.waitFor(() => expect(ids()).toHaveLength(PAGE_SIZE))
  expect(ids()[0]).toBe(`m${PAGE_SIZE * 2}`)
  expect(ids().at(-1)).toBe(`m${PAGE_SIZE * 3 - 1}`)
  expect(registry.get(transcript.paging).hasBefore).toBe(true)

  registry.set(loadItemsBeforeAtom, "s1")
  await vi.waitFor(() => expect(ids()).toHaveLength(PAGE_SIZE * 2))
  expect(ids()[0]).toBe(`m${PAGE_SIZE}`)
})

test("trimming a transcript that holds one page changes nothing", async () => {
  const { registry, transcript, ids } = await setup(PAGE_SIZE)
  registry.set(trimTranscriptAtom, "s1")
  await Promise.resolve()
  expect(ids()).toHaveLength(PAGE_SIZE)
  expect(registry.get(transcript.paging).hasBefore).toBe(false)
})

test("trimming keeps the last page of the main agent's items, however many subagent steps follow them", async () => {
  const { registry, transcript, ids } = await setup(PAGE_SIZE * 2)
  registry.set(loadItemsBeforeAtom, "s1")
  await vi.waitFor(() => expect(ids()).toHaveLength(PAGE_SIZE * 2))
  const steps = Array.from({ length: PAGE_SIZE }, (_, i) => ({
    ...message(PAGE_SIZE * 2 + i),
    id: `step${i}`,
    parentToolCallId: "agent",
  }))
  await Effect.runPromise(
    transcript.list.upsert(steps).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
  )

  registry.set(trimTranscriptAtom, "s1")
  await vi.waitFor(() => expect(ids()).toHaveLength(PAGE_SIZE * 2))
  expect(ids()[0]).toBe(`m${PAGE_SIZE}`)
})
