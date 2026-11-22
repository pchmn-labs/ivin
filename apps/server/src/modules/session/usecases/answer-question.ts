import { SessionNotFound } from "@ivin/contracts/session"
import type { QuestionAnswer } from "@ivin/contracts/transcript"
import { Effect } from "effect"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const answerQuestion = (
  sessionId: string,
  requestId: string,
  answers: readonly QuestionAnswer[] | null,
) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const runs = yield* SessionRuns
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    yield* runs.answerQuestion(session, { requestId, answers })
    return (yield* store.findById(sessionId)) ?? session
  })
