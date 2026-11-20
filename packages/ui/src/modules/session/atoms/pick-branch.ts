import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sessionsOf } from "./list-sessions.ts"

export const pickBranchAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly name: string
  readonly remote: boolean
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, name, remote }) {
    const client = yield* ServerClient
    const session = yield* client["session.pickBranch"]({ sessionId, name, remote })
    yield* sessionsOf(projectPath).upsert([session])
    return session
  }),
)
