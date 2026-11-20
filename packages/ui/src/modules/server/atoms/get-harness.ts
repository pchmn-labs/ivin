import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const getHarnessAtom = serverRuntime
  .atom(
    Effect.gen(function* () {
      const client = yield* ServerClient
      return yield* client["server.getHarness"]()
    }),
  )
  .pipe(Atom.keepAlive)
