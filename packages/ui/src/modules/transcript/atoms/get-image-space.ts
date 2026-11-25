import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import type { DeleteScope } from "../rules/image-space.ts"

// Bumped by each delete, so every count shown reads the server again.
export const imagesDeletedAtom = Atom.make(0).pipe(Atom.keepAlive)

export const imageSpaceOf = Atom.family((olderThanDays: DeleteScope) =>
  serverRuntime.atom((get) =>
    Effect.gen(function* () {
      get(imagesDeletedAtom)
      const client = yield* ServerClient
      return yield* client["transcript.getImageSpace"](
        olderThanDays === null ? {} : { olderThanDays },
      )
    }),
  ),
)
