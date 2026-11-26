import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export interface TrustedVersion {
  readonly project: string
  readonly id: string
  readonly hash: string
}

export const trustKey = (project: string, id: string) => `${project}\0${id}`

// One per plugin, so a failure shows on the plugin it belongs to.
export const trustProjectPluginOf = Atom.family((_key: string) =>
  serverRuntime.fn<TrustedVersion>()(
    Effect.fnUntraced(function* (version) {
      const client = yield* ServerClient
      yield* client["plugin.trust"](version)
    }),
  ),
)
