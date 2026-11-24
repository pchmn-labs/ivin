import { Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

// Each batch of paths changed on disk in the session's working folder, while mounted.
const family = Atom.family((key: string) => {
  const [sessionId = ""] = key.split("\n")
  return serverRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return client["file.watch"]({ sessionId })
      }),
    ),
  )
})

export const folderChangesOf = (sessionId: string, workingFolder: string) =>
  family(`${sessionId}\n${workingFolder}`)
