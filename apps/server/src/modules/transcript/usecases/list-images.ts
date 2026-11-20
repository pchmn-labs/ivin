import type { SessionImage } from "@ivin/contracts/transcript"
import { Effect } from "effect"
import { TranscriptStore } from "./transcript-store.ts"

export const listImages = (sessionId: string) =>
  Effect.gen(function* () {
    const events = yield* (yield* TranscriptStore).events(sessionId)
    return events.flatMap((event): SessionImage[] =>
      event.type === "user_message"
        ? (event.images ?? []).map((image) => ({
            ...image,
            messageId: event.id,
            messageText: event.text,
          }))
        : [],
    )
  })
