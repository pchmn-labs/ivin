import { Effect } from "effect"
import { TranscriptStore } from "./transcript-store.ts"

export const getTaskItems = (sessionId: string, toolCallId: string) =>
  Effect.gen(function* () {
    return yield* (yield* TranscriptStore).itemsOfTask(sessionId, toolCallId)
  })
