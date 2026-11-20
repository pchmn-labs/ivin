import { Effect } from "effect"
import type { WorkingFolderChoice } from "@ivin/contracts/session"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sessionsOf } from "./list-sessions.ts"

export const pickWorkingFolderAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly workingFolder: WorkingFolderChoice
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, workingFolder }) {
    const client = yield* ServerClient
    const session = yield* client["session.pickWorkingFolder"]({ sessionId, workingFolder })
    yield* sessionsOf(projectPath).upsert([session])
    return session
  }),
)
