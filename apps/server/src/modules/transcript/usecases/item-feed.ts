import type { TranscriptItemChange } from "@ivin/contracts/transcript"
import type { Effect } from "effect"
import { Context, Layer, type Scope, type Stream } from "effect"
import { makeWatcherFeed } from "../../../shared/usecases/watcher-feed.ts"

const WATCHER_BUFFER = 1024

export type FeedChange = Exclude<TranscriptItemChange, { type: "page" }>

export class ItemFeed extends Context.Service<
  ItemFeed,
  {
    readonly publish: (change: FeedChange) => Effect.Effect<void>
    readonly watch: (
      sessionId: string,
      current: Effect.Effect<readonly TranscriptItemChange[]>,
    ) => Effect.Effect<Stream.Stream<TranscriptItemChange>, never, Scope.Scope>
  }
>()("ivin/server/ItemFeed") {}

export const layerItemFeed = Layer.sync(ItemFeed)(() => {
  const feed = makeWatcherFeed<string, TranscriptItemChange>({
    capacity: WATCHER_BUFFER,
    matches: (sessionId, change) =>
      change.type === "upsert"
        ? change.item.sessionId === sessionId
        : change.type === "delta" && change.sessionId === sessionId,
  })
  return { publish: feed.publish, watch: feed.watch }
})
