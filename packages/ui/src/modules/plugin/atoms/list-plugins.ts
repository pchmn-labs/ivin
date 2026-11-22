import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect, Stream } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

const NONE: ReadonlyArray<UserPlugin> = []

// The user's plugins listed so far: one that installs dependencies arrives after the others.
export const listPluginsAtom = serverRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const client = yield* ServerClient
      return client["plugin.list"]().pipe(
        Stream.scan(
          () => NONE,
          (listed, plugin) => [...listed, plugin],
        ),
      )
    }),
  ),
)
