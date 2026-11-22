import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const listPluginsAtom = serverRuntime.atom(
  Effect.gen(function* () {
    const client = yield* ServerClient
    return yield* client["plugin.list"]()
  }),
)
