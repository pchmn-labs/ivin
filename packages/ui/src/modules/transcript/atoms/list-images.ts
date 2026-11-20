import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

// Not kept alive: each opening of the full-screen view lists the images sent since.
export const sessionImagesOf = Atom.family((sessionId: string) =>
  serverRuntime.atom(
    Effect.gen(function* () {
      const client = yield* ServerClient
      return yield* client["transcript.listImages"]({ sessionId })
    }),
  ),
)
