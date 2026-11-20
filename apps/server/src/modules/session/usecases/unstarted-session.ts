import { SessionAlreadyStarted, SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "./session-store.ts"

export const unstartedSession = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    if (session.started) return yield* new SessionAlreadyStarted({ sessionId })
    return session
  })
