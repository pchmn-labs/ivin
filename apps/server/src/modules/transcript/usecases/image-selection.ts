import { Clock, Effect } from "effect"
import type { StoredImageSelection } from "./image-store.ts"
import { SessionsWithTab } from "./sessions-with-tab.ts"

const DAY_MS = 24 * 60 * 60 * 1000

export const imageSelection = ({
  olderThanDays,
  inactiveSessions = false,
}: {
  readonly olderThanDays?: number | undefined
  readonly inactiveSessions?: boolean | undefined
}) =>
  Effect.gen(function* (): Effect.fn.Return<StoredImageSelection, never, SessionsWithTab> {
    const now = yield* Clock.currentTimeMillis
    return {
      sentBefore: olderThanDays === undefined ? null : now - olderThanDays * DAY_MS,
      exceptSessions: inactiveSessions ? yield* (yield* SessionsWithTab).ids : null,
    }
  })
