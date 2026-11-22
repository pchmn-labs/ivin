import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const sendNow = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    yield* (yield* SessionRuns).sendNow(sessionId)
    return (yield* store.findById(sessionId)) ?? session
  })
