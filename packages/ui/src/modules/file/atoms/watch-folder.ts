import { Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

// Each batch of paths changed on disk in the session's working folder, while mounted.
export const folderChangesOf = Atom.family((sessionId: string) =>
  serverRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return client["file.watch"]({ sessionId })
      }),
    ),
  ),
)
