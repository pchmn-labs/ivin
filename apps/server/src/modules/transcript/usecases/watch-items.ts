import type { TranscriptItemChange } from "@ivin/contracts/transcript"
import type { HarnessProvider } from "@ivin/harness"
import { Effect, Stream } from "effect"
import { getItems } from "./get-items.ts"
import { ItemFeed } from "./item-feed.ts"
import { TranscriptStore } from "./transcript-store.ts"

// The last page, then the open tool calls and requests older than it, which the page can miss.
const currentItems = (sessionId: string, before: number) =>
  Effect.gen(function* () {
    const page = yield* getItems(sessionId, null, before, 0)
    const { openToolCalls, openRequests } = yield* (yield* TranscriptStore).itemState(sessionId)
    const firstPosition = page.items[0]?.position ?? Number.MAX_SAFE_INTEGER
    const older = [...openToolCalls.values(), ...openRequests.values()]
      .filter((item) => item.position < firstPosition)
      .toSorted((a, b) => a.position - b.position)
    return [
      { type: "page", page },
      ...older.map((item): TranscriptItemChange => ({ type: "upsert", item })),
    ] satisfies TranscriptItemChange[]
  })

export const watchItems = (sessionId: string, before: number) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const current = currentItems(sessionId, before)
      const context = yield* Effect.context<HarnessProvider | TranscriptStore>()
      const changes = yield* (yield* ItemFeed).watch(sessionId, Effect.provide(current, context))
      return Stream.fromIterable(yield* currentItems(sessionId, before)).pipe(
        Stream.concat(changes),
      )
    }),
  )
