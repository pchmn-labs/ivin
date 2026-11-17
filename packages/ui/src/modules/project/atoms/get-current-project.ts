import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const getCurrentProjectAtom = serverRuntime.atom(
  Effect.gen(function* () {
    const client = yield* ServerClient
    return yield* client["project.getCurrent"]()
  }),
)
