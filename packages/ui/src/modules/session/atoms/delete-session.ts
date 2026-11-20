import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { archivedSessionsOf } from "./list-archived-sessions.ts"
import { sessionsOf } from "./list-sessions.ts"
import { recordingFailure } from "./session-action-failure.ts"

export const deleteSessionAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
}>()(({ projectPath, sessionId }) =>
  Effect.gen(function* () {
    const client = yield* ServerClient
    yield* client["session.delete"]({ sessionId })
    yield* sessionsOf(projectPath).remove(sessionId)
    yield* tabsOf(projectPath).set(yield* client["tab.list"]({ projectPath }))
    yield* Atom.refresh(archivedSessionsOf(projectPath))
  }).pipe(recordingFailure("delete", sessionId)),
)
