import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const setFullTrustOf = Atom.family((project: string) =>
  serverRuntime.fn<boolean>()(
    Effect.fnUntraced(function* (enabled) {
      const client = yield* ServerClient
      yield* client["plugin.setFullTrust"]({ project, enabled })
    }),
  ),
)
