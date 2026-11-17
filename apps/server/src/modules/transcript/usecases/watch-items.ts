import { Effect, Stream } from "effect"
import { ItemFeed } from "./item-feed.ts"

export const watchItems = (sessionId: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const feed = yield* ItemFeed
      return feed.watch(sessionId)
    }),
  )
