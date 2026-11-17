import type { TranscriptItem } from "@ivin/contracts/transcript"
import { Context, Effect, Layer, PubSub, Stream } from "effect"

const FEED_CAPACITY = 1024

export class ItemFeed extends Context.Service<
  ItemFeed,
  {
    readonly publish: (item: TranscriptItem) => Effect.Effect<void>
    readonly watch: (sessionId: string) => Stream.Stream<TranscriptItem>
  }
>()("ivin/server/ItemFeed") {}

// Sliding: a slow watcher loses the oldest upserts rather than stalling the writer.
export const layerItemFeed = Layer.effect(ItemFeed)(
  Effect.gen(function* () {
    const pubsub = yield* Effect.acquireRelease(
      PubSub.sliding<TranscriptItem>(FEED_CAPACITY),
      PubSub.shutdown,
    )
    return {
      publish: (item) => PubSub.publish(pubsub, item).pipe(Effect.asVoid),
      watch: (sessionId) =>
        Stream.fromPubSub(pubsub).pipe(Stream.filter((item) => item.sessionId === sessionId)),
    }
  }),
)
