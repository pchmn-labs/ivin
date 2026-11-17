import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const answerApproval = (sessionId: string, requestId: string, allow: boolean) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const runs = yield* SessionRuns
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    yield* runs.answerApproval(session, { requestId, allow })
    return (yield* store.findById(sessionId)) ?? session
  })
