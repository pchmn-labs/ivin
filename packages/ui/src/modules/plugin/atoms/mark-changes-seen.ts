import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const markChangesSeenOf = Atom.family((project: string) =>
  serverRuntime.fn<void>()(
    Effect.fnUntraced(function* () {
      const client = yield* ServerClient
      yield* client["plugin.markChangesSeen"]({ project })
    }),
  ),
)
