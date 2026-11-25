import { Effect } from "effect"
import { ImageStore } from "./image-store.ts"
import { sentBefore } from "./sent-before.ts"

export const getImageSpace = (olderThanDays: number | undefined) =>
  Effect.gen(function* () {
    return yield* (yield* ImageStore).space(yield* sentBefore(olderThanDays))
  })
