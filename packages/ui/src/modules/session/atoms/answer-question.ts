import type { QuestionAnswer } from "@ivin/contracts/transcript"
import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sessionsOf } from "./list-sessions.ts"

export const answerQuestionAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly requestId: string
  readonly answers: readonly QuestionAnswer[] | null
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, requestId, answers }) {
    const client = yield* ServerClient
    const session = yield* client["session.answerQuestion"]({ sessionId, requestId, answers })
    yield* sessionsOf(projectPath).upsert([session])
    return session
  }),
)
