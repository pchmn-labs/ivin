import type { LocalChangesChoice } from "@ivin/contracts/session"
import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sessionsOf } from "./list-sessions.ts"

export const switchToDefaultBranchAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly localChanges?: LocalChangesChoice
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, localChanges }) {
    const client = yield* ServerClient
    const session = yield* client["session.switchToDefaultBranch"]({
      sessionId,
      ...(localChanges && { localChanges }),
    })
    yield* sessionsOf(projectPath).upsert([session])
    return session
  }),
)
