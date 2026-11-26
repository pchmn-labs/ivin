import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const removeAnnotationAtom = serverRuntime.fn<{ readonly id: string }>()(
  Effect.fnUntraced(function* ({ id }) {
    const client = yield* ServerClient
    yield* client["annotation.remove"]({ id })
  }),
)
