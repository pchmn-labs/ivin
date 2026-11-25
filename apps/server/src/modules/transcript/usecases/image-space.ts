import { Clock, Effect } from "effect"
import { ImageStore } from "./image-store.ts"

const DAY_MS = 24 * 60 * 60 * 1000

const sentBefore = (olderThanDays: number | undefined) =>
  olderThanDays === undefined
    ? Effect.succeed(null)
    : Effect.map(Clock.currentTimeMillis, (now) => now - olderThanDays * DAY_MS)

export const getImageSpace = (olderThanDays: number | undefined) =>
  Effect.gen(function* () {
    return yield* (yield* ImageStore).space(yield* sentBefore(olderThanDays))
  })

export const deleteImages = (olderThanDays: number | undefined) =>
  Effect.gen(function* () {
    return yield* (yield* ImageStore).remove(yield* sentBefore(olderThanDays))
  })
