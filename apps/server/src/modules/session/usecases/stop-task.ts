import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const stopTask = (sessionId: string, taskId: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    if (!(yield* store.findById(sessionId))) return yield* new SessionNotFound({ sessionId })
    yield* (yield* SessionRuns).stopTask(sessionId, taskId)
  })
