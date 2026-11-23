import type { SessionUsage } from "@ivin/contracts/transcript"
import { Effect, Stream } from "effect"
import { ensureItems } from "./ensure-items.ts"
import { ItemFeed } from "./item-feed.ts"
import { TranscriptStore } from "./transcript-store.ts"

export const watchUsage = (sessionId: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const store = yield* TranscriptStore
      const changes = yield* (yield* ItemFeed).watch(sessionId)
      yield* ensureItems(sessionId)
      const total = store.usageTotal(sessionId)
      return Stream.fromEffect(total).pipe(
        Stream.concat(
          changes.pipe(
            Stream.filter((change) => change.type === "upsert" && change.item.type === "usage"),
            Stream.mapEffect(() => total),
          ),
        ),
      ) satisfies Stream.Stream<SessionUsage, never, TranscriptStore>
    }),
  )
