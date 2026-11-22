import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const userPluginsAtom = serverRuntime.atom(
  Effect.gen(function* () {
    const client = yield* ServerClient
    return yield* client["plugin.list"]()
  }),
)

export const reportPluginFailureAtom = serverRuntime.fn<{ id: string; reason: string }>()(
  Effect.fnUntraced(function* (failure) {
    const client = yield* ServerClient
    yield* client["plugin.reportFailure"](failure)
  }),
)
