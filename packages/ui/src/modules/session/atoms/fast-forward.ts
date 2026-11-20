import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sessionsOf } from "./list-sessions.ts"

export const fastForwardAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly stash?: boolean
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, stash }) {
    const client = yield* ServerClient
    const session = yield* client["session.fastForward"]({ sessionId, stash: stash === true })
    yield* sessionsOf(projectPath).upsert([session])
    return session
  }),
)
