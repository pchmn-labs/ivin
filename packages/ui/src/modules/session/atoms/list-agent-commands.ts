import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const agentCommandsOf = Atom.family((sessionId: string) =>
  serverRuntime
    .atom(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return yield* client["session.listAgentCommands"]({ sessionId })
      }),
    )
    // Kept while ivin runs, so the menu opens on the last list while it is asked again.
    .pipe(Atom.keepAlive),
)
