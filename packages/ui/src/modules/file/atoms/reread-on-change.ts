import { Effect, Stream } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

// Runs `read` once, then again after each batch of changes on disk in the session's working folder.
export const rereadOnChange = <A, E>(
  sessionId: string,
  read: (client: ServerClient["Service"]) => Effect.Effect<A, E>,
) =>
  serverRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return Stream.merge(Stream.make(undefined), client["file.watch"]({ sessionId })).pipe(
          Stream.mapEffect(() => read(client)),
        )
      }),
    ),
  )
