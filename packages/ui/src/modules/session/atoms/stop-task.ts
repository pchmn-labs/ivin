import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const stopTaskAtom = serverRuntime.fn<{
  readonly sessionId: string
  readonly taskId: string
}>()(
  Effect.fnUntraced(function* ({ sessionId, taskId }) {
    const client = yield* ServerClient
    yield* client["session.stopTask"]({ sessionId, taskId })
  }),
)
