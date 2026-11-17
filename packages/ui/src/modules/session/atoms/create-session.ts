import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { selectedSessionIdAtom } from "./selected-session.ts"
import { sessionsOf } from "./list-sessions.ts"

export const createSessionAtom = serverRuntime.fn<{ projectPath: string; model: string }>()(
  Effect.fnUntraced(function* ({ projectPath, model }, get) {
    const client = yield* ServerClient
    const session = yield* client["session.create"]({ projectPath, model })
    yield* sessionsOf(projectPath).upsert([session])
    get.set(selectedSessionIdAtom, session.id)
    return session
  }),
)
