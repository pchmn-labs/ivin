import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

const NONE: ReadonlyArray<UserPlugin> = []

export const listPluginsAtom = serverRuntime
  .atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return client["plugin.list"]().pipe(
          Stream.scan(
            () => NONE,
            (listed, plugin) => {
              // A reloaded plugin takes the place of its earlier entry, so the order of the others holds.
              const at = listed.findIndex((earlier) => earlier.id === plugin.id)
              return at === -1 ? [...listed, plugin] : listed.with(at, plugin)
            },
          ),
        )
      }),
    ),
  )
  .pipe(Atom.keepAlive)
