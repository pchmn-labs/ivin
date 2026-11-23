import type { SessionUsage } from "@ivin/contracts/transcript"
import type { HarnessProvider } from "@ivin/harness"
import { Effect, Stream } from "effect"
import { ensureItems } from "./ensure-items.ts"
import { getItems } from "./get-items.ts"
import { ItemFeed } from "./item-feed.ts"
import { TranscriptStore } from "./transcript-store.ts"

export const watchUsage = (sessionId: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const store = yield* TranscriptStore
      const context = yield* Effect.context<HarnessProvider | TranscriptStore>()
      // A watcher that fell behind gets this page back, and reads the total again.
      const replay = getItems(sessionId, null, Number.MAX_SAFE_INTEGER, 0).pipe(
        Effect.map((page) => [{ type: "page", page }] as const),
      )
      const changes = yield* (yield* ItemFeed).watch(sessionId, Effect.provide(replay, context))
      yield* ensureItems(sessionId)
      const total = store.usageTotal(sessionId)
      return Stream.fromEffect(total).pipe(
        Stream.concat(
          changes.pipe(
            Stream.filter(
              (change) =>
                change.type === "page" ||
                (change.type === "upsert" && change.item.type === "usage"),
            ),
            Stream.mapEffect(() => total),
          ),
        ),
      ) satisfies Stream.Stream<SessionUsage, never, TranscriptStore>
    }),
  )
