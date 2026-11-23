import type { SessionImage } from "@ivin/contracts/transcript"
import { Effect } from "effect"
import { TranscriptStore } from "./transcript-store.ts"

export const listImages = (sessionId: string) =>
  Effect.gen(function* () {
    const messages = yield* (yield* TranscriptStore).userMessages(sessionId)
    return messages.flatMap((message): SessionImage[] =>
      (message.images ?? []).map((image) => ({
        ...image,
        messageId: message.id,
        messageText: message.text,
      })),
    )
  })
