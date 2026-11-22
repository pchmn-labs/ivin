import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const discardChangeAtom = serverRuntime.fn<{
  readonly sessionId: string
  readonly path: string
}>()(
  Effect.fnUntraced(function* ({ sessionId, path }) {
    const client = yield* ServerClient
    return yield* client["file.discardChange"]({ sessionId, path })
  }),
)

export const discardAllChangesAtom = serverRuntime.fn<{ readonly sessionId: string }>()(
  Effect.fnUntraced(function* ({ sessionId }) {
    const client = yield* ServerClient
    return yield* client["file.discardAllChanges"]({ sessionId })
  }),
)
