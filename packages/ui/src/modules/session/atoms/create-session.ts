import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sessionsOf } from "./list-sessions.ts"

export const createSessionAtom = serverRuntime.fn<{ projectPath: string }>()(
  Effect.fnUntraced(function* ({ projectPath }) {
    const client = yield* ServerClient
    const session = yield* client["session.create"]({ projectPath })
    yield* sessionsOf(projectPath).upsert([session])
    return session
  }),
)
