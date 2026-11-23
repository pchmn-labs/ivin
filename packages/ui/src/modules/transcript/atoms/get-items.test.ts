import { expect, test, vi } from "vitest"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { transcriptOf } from "./get-items.ts"

const setup = async () => {
  const { registry, server } = makeTestRegistry()
  // Mounting another server atom first avoids a crash when the feed is the first to build the runtime.
  registry.mount(sessionsOf("/p").ids)
  const transcript = transcriptOf("s1")
  registry.mount(transcript.view)
  await vi.waitFor(() => expect(registry.get(transcript.view).loaded).toBe(true))
  return { registry, server, transcript }
}

const delta = (itemId: string, text: string, position = 0) =>
  ({
    type: "delta",
    sessionId: "s1",
    itemId,
    position,
    kind: "message",
    text,
  }) as const

test("deltas are applied in one write per frame, creating the item at its position", async () => {
  const { registry, server, transcript } = await setup()
  const writes = vi.fn()
  registry.subscribe(transcript.list.item("a"), writes)

  server.pushChange(delta("a", "Hel"))
  server.pushChange(delta("a", "lo"))
  server.pushChange(delta("a", "!"))
  await vi.waitFor(() =>
    expect(registry.get(transcript.list.item("a"))).toMatchObject({
      type: "message",
      role: "assistant",
      position: 0,
      text: "Hello!",
    }),
  )
  expect(writes).toHaveBeenCalledTimes(1)

  server.pushChange(delta("a", " More"))
  await vi.waitFor(() =>
    expect(registry.get(transcript.list.item("a"))).toMatchObject({ text: "Hello! More" }),
  )
})

test("an upsert after deltas wins over the pending text", async () => {
  const { registry, server, transcript } = await setup()
  const stored: TranscriptItem = {
    id: "a",
    sessionId: "s1",
    position: 0,
    at: 0,
    type: "message",
    role: "assistant",
    text: "Final text",
    images: [],
    steer: false,
  }

  server.pushChange(delta("a", "stale"))
  server.pushChange({ type: "upsert", item: stored })
  // Deltas flush in the order they came, so once this one shows, the stale ones had their turn.
  server.pushChange(delta("b", "later", 1))
  await vi.waitFor(() =>
    expect(registry.get(transcript.list.item("b"))).toMatchObject({ text: "later" }),
  )
  expect(registry.get(transcript.list.item("a"))).toEqual(stored)
})

test("a feed that fails marks the transcript failed, and refreshing it loads the transcript", async () => {
  const { registry, server } = makeTestRegistry()
  registry.mount(sessionsOf("/p").ids)
  server.failNextCall("transcript.watchItems")
  const transcript = transcriptOf("s1")
  registry.mount(transcript.view)
  await vi.waitFor(() =>
    expect(registry.get(transcript.view)).toMatchObject({ failed: true, loaded: false }),
  )

  registry.refresh(transcript.list.status)
  await vi.waitFor(() =>
    expect(registry.get(transcript.view)).toMatchObject({ failed: false, loaded: true }),
  )
})
