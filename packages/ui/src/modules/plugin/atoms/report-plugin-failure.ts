import type { PluginFailure } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const reportPluginFailureAtom = serverRuntime.fn<PluginFailure>()(
  Effect.fnUntraced(function* (failure) {
    const client = yield* ServerClient
    yield* client["plugin.reportFailure"](failure)
  }),
)
