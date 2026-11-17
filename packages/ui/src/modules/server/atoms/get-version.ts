import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const getVersionAtom = serverRuntime.atom(
  Effect.gen(function* () {
    const client = yield* ServerClient
    const { version } = yield* client["server.getVersion"]()
    return version
  }),
)
