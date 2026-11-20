import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { archivedSessionsOf } from "./list-archived-sessions.ts"
import { sessionsOf } from "./list-sessions.ts"
import { recordingFailure } from "./session-action-failure.ts"

export const restoreSessionAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
}>()(({ projectPath, sessionId }) =>
  Effect.gen(function* () {
    const client = yield* ServerClient
    const session = yield* client["session.restore"]({ sessionId })
    yield* sessionsOf(projectPath).upsert([session])
    yield* Atom.refresh(archivedSessionsOf(projectPath))
  }).pipe(recordingFailure("restore", sessionId)),
)
