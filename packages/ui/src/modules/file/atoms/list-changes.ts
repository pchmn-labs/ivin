import { Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

// Listed again after each change on disk.
export const changesOf = Atom.family((sessionId: string) =>
  serverRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return Stream.merge(Stream.make(undefined), client["file.watch"]({ sessionId })).pipe(
          Stream.mapEffect(() => client["file.listChanges"]({ sessionId })),
        )
      }),
    ),
  ),
)
