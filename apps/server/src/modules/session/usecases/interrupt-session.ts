import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const interruptSession = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const runs = yield* SessionRuns
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    yield* runs.interrupt(sessionId)
    return (yield* store.findById(sessionId)) ?? session
  })
