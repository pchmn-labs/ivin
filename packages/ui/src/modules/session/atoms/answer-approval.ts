import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sessionsOf } from "./list-sessions.ts"

export const answerApprovalAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly requestId: string
  readonly allow: boolean
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, requestId, allow }) {
    const client = yield* ServerClient
    const session = yield* client["session.answerApproval"]({ sessionId, requestId, allow })
    yield* sessionsOf(projectPath).upsert([session])
    return session
  }),
)
