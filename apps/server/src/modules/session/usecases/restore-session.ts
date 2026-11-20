import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

export const restoreSession = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    yield* store.setArchivedAt(sessionId, null)
    yield* (yield* SessionFeed).publish(sessionId)
    return { ...session, archivedAt: null }
  })
