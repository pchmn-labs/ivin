import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const listBuiltinPluginsAtom = serverRuntime
  .atom(
    Effect.gen(function* () {
      const client = yield* ServerClient
      return yield* client["plugin.listBuiltin"]()
    }),
  )
  .pipe(Atom.keepAlive)
