import type { TranscriptItem } from "@ivin/contracts/transcript"
import { Context, Effect, Layer, PubSub, type Scope, Stream } from "effect"

const FEED_CAPACITY = 1024

export class ItemFeed extends Context.Service<
  ItemFeed,
  {
    readonly publish: (item: TranscriptItem) => Effect.Effect<void>
    // Subscribed on return: nothing published afterwards is missed.
    readonly watch: (
      sessionId: string,
    ) => Effect.Effect<Stream.Stream<TranscriptItem>, never, Scope.Scope>
  }
>()("ivin/server/ItemFeed") {}

export const layerItemFeed = Layer.effect(ItemFeed)(
  Effect.gen(function* () {
    // Sliding: a slow watcher loses the oldest upserts rather than stalling the writer.
    const pubsub = yield* Effect.acquireRelease(
      PubSub.sliding<TranscriptItem>(FEED_CAPACITY),
      PubSub.shutdown,
    )
    return {
      publish: (item) => PubSub.publish(pubsub, item).pipe(Effect.asVoid),
      watch: (sessionId) =>
        PubSub.subscribe(pubsub).pipe(
          Effect.map((subscription) =>
            Stream.fromSubscription(subscription).pipe(
              Stream.filter((item) => item.sessionId === sessionId),
            ),
          ),
        ),
    }
  }),
)
