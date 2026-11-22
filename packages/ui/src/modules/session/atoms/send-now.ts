import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sessionsOf } from "./list-sessions.ts"

export const sendNowAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId }) {
    const client = yield* ServerClient
    const session = yield* client["session.sendNow"]({ sessionId })
    yield* sessionsOf(projectPath).upsert([session])
    return session
  }),
)
