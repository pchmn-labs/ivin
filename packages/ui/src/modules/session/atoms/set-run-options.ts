import { Effect } from "effect"
import type { RunOptions, Session } from "@ivin/contracts/session"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sessionsOf } from "./list-sessions.ts"

export const setRunOptionsAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly options: Partial<RunOptions>
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, options }) {
    const client = yield* ServerClient
    const sessions = sessionsOf(projectPath)
    const before = yield* sessions.get(sessionId)
    return yield* optimistic<Session>({
      apply: before ? sessions.upsert([{ ...before, ...options }]) : Effect.void,
      rollback: before ? sessions.upsert([before]) : Effect.void,
      reconcile: (session) => sessions.upsert([session]),
    })(client["session.setRunOptions"]({ sessionId, options }))
  }),
  { concurrent: true },
)
