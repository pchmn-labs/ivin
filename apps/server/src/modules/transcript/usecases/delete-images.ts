import { Effect } from "effect"
import { ImageStore } from "./image-store.ts"
import { sentBefore } from "./sent-before.ts"

export const deleteImages = (olderThanDays: number | undefined) =>
  Effect.gen(function* () {
    return yield* (yield* ImageStore).remove(yield* sentBefore(olderThanDays))
  })
