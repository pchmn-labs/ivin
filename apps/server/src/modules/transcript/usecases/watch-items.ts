import type { TranscriptItemChange } from "@ivin/contracts/transcript"
import { Effect, Stream } from "effect"
import { getItems } from "./get-items.ts"
import { ItemFeed } from "./item-feed.ts"

export const watchItems = (sessionId: string, before: number) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const feed = yield* ItemFeed
      const upserts = yield* feed.watch(sessionId)
      const page = yield* getItems(sessionId, null, before, 0)
      return Stream.make<[TranscriptItemChange]>({ type: "page", page }).pipe(
        Stream.concat(
          upserts.pipe(Stream.map((item): TranscriptItemChange => ({ type: "upsert", item }))),
        ),
      )
    }),
  )
