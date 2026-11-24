import { Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { isOutsidePath } from "../rules/file-link.ts"

const family = Atom.family((key: string) => {
  const [sessionId = "", , path = ""] = key.split("\n")
  if (isOutsidePath(path)) {
    return serverRuntime.atom(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return yield* client["file.readOutsideFile"]({ sessionId, path })
      }),
    )
  }
  return serverRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        const changes = client["file.watch"]({ sessionId }).pipe(
          Stream.filter((change) => change.paths.includes(path)),
        )
        return Stream.merge(Stream.make(undefined), changes).pipe(
          Stream.buffer({ capacity: 1, strategy: "sliding" }),
          Stream.mapEffect(() => client["file.readFile"]({ sessionId, path })),
        )
      }),
    ),
  )
})

export const fileContentOf = (sessionId: string, workingFolder: string, path: string) =>
  family(`${sessionId}\n${workingFolder}\n${path}`)
