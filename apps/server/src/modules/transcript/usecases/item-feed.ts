import type { TranscriptItemChange } from "@ivin/contracts/transcript"
import { Context, Effect, Layer, PubSub, type Scope, Stream } from "effect"

const FEED_CAPACITY = 1024

export type FeedChange = Exclude<TranscriptItemChange, { type: "page" }>

export class ItemFeed extends Context.Service<
  ItemFeed,
  {
    readonly publish: (change: FeedChange) => Effect.Effect<void>
    // Subscribed on return: nothing published afterwards is missed.
    readonly watch: (
      sessionId: string,
    ) => Effect.Effect<Stream.Stream<FeedChange>, never, Scope.Scope>
  }
>()("ivin/server/ItemFeed") {}

export const layerItemFeed = Layer.effect(ItemFeed)(
  Effect.gen(function* () {
    // Sliding: a slow watcher loses the oldest upserts rather than stalling the writer.
    const pubsub = yield* Effect.acquireRelease(
      PubSub.sliding<FeedChange>(FEED_CAPACITY),
      PubSub.shutdown,
    )
    return {
      publish: (change) => PubSub.publish(pubsub, change).pipe(Effect.asVoid),
      watch: (sessionId) =>
        PubSub.subscribe(pubsub).pipe(
          Effect.map((subscription) =>
            Stream.fromSubscription(subscription).pipe(
              Stream.filter(
                (change) =>
                  (change.type === "upsert" ? change.item.sessionId : change.sessionId) ===
                  sessionId,
              ),
            ),
          ),
        ),
    }
  }),
)
