import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

// Not kept alive: a file shown again is read again, as the agent may have changed it.
const family = Atom.family((key: string) => {
  const [sessionId = "", , path = ""] = key.split("\n")
  return serverRuntime.atom(
    Effect.gen(function* () {
      const client = yield* ServerClient
      return yield* client["file.readFile"]({ sessionId, path })
    }),
  )
})

export const fileContentOf = (sessionId: string, workingFolder: string, path: string) =>
  family(`${sessionId}\n${workingFolder}\n${path}`)
