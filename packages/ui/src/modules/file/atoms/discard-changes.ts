import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const discardChangesAtom = serverRuntime.fn<{
  readonly sessionId: string
  readonly paths: ReadonlyArray<string>
}>()(
  Effect.fnUntraced(function* ({ sessionId, paths }) {
    const client = yield* ServerClient
    return yield* client["file.discardChanges"]({ sessionId, paths })
  }),
)
