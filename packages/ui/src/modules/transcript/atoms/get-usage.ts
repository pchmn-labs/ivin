import { Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

// Not kept alive: it is read only while a status line shows it.
export const usageOf = Atom.family((sessionId: string) =>
  serverRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return client["transcript.watchUsage"]({ sessionId })
      }),
    ),
  ),
)
