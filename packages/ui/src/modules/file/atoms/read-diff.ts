import { Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

// Read again after each change on disk.
const family = Atom.family((key: string) => {
  const [sessionId = "", , path = ""] = key.split("\n")
  return serverRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return Stream.merge(Stream.make(undefined), client["file.watch"]({ sessionId })).pipe(
          Stream.mapEffect(() => client["file.readDiff"]({ sessionId, path })),
        )
      }),
    ),
  )
})

export const diffOf = (sessionId: string, workingFolder: string, path: string) =>
  family(`${sessionId}\n${workingFolder}\n${path}`)
