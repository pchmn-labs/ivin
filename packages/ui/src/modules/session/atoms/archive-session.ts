import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { discardSessionEditsAtom } from "../../file/atoms/file-edit.ts"
import { closingTab } from "../../tab/atoms/close-tab.ts"
import { archivedSessionsOf } from "./list-archived-sessions.ts"
import { sessionsOf } from "./list-sessions.ts"
import { recordingFailure } from "./session-action-failure.ts"

export const archiveSessionAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
}>()(
  ({ projectPath, sessionId }) =>
    Effect.gen(function* () {
      const client = yield* ServerClient
      const sessions = sessionsOf(projectPath)
      const before = yield* sessions.get(sessionId)
      // The server may have archived the session before it failed.
      const putBack = client["session.list"]({ projectPath }).pipe(
        Effect.map((listed) => listed.filter((session) => session.id === sessionId)),
        Effect.orElseSucceed(() => (before ? [before] : [])),
        Effect.flatMap((kept) => sessions.upsert(kept)),
      )
      const archive = client["session.archive"]({ sessionId }).pipe(
        Effect.andThen(client["tab.list"]({ projectPath })),
      )
      yield* Atom.update(sessions.archiving, (ids) => [...ids, sessionId])
      yield* sessions.remove(sessionId)
      yield* closingTab(
        projectPath,
        sessionId,
      )(archive).pipe(
        Effect.onError(() => putBack),
        Effect.ensuring(
          Atom.update(sessions.archiving, (ids) => ids.filter((id) => id !== sessionId)),
        ),
      )
      yield* Atom.set(discardSessionEditsAtom, sessionId)
      yield* Atom.refresh(archivedSessionsOf(projectPath))
    }).pipe(recordingFailure("archive", sessionId)),
  { concurrent: true },
)
