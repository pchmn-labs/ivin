import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const listFilesOf = Atom.family((_sessionId: string) =>
  serverRuntime.fn<{ readonly sessionId: string }>()(
    Effect.fnUntraced(function* ({ sessionId }) {
      const client = yield* ServerClient
      return yield* client["file.listFiles"]({ sessionId })
    }),
  ),
)
