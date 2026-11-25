import { Clock, Effect } from "effect"

const DAY_MS = 24 * 60 * 60 * 1000

export const sentBefore = (olderThanDays: number | undefined) =>
  olderThanDays === undefined
    ? Effect.succeed(null)
    : Effect.map(Clock.currentTimeMillis, (now) => now - olderThanDays * DAY_MS)
