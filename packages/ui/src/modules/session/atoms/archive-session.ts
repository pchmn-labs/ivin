import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
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
      yield* optimistic<unknown>({
        apply: sessions.remove(sessionId),
        rollback: before ? sessions.upsert([before]) : Effect.void,
      })(
        closingTab(
          projectPath,
          sessionId,
        )(
          client["session.archive"]({ sessionId }).pipe(
            Effect.andThen(client["tab.list"]({ projectPath })),
          ),
        ),
      )
      yield* Atom.refresh(archivedSessionsOf(projectPath))
    }).pipe(recordingFailure("archive", sessionId)),
  { concurrent: true },
)
