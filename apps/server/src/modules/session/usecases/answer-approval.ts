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
    // A harness failure is a defect here: the contract has no error for it yet.
    yield* runs
      .answerApproval(session, { requestId, allow })
      .pipe(Effect.catchTag("HarnessError", Effect.die))
    return (yield* store.findById(sessionId)) ?? session
  })
