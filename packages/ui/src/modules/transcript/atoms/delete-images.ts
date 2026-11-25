import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import type { DeleteScope } from "../rules/image-space.ts"
import { imagesDeletedAtom } from "./get-image-space.ts"

export const deletedImageIdsAtom = Atom.make<ReadonlyMap<string, true>>(new Map()).pipe(
  Atom.keepAlive,
)

export const deleteImagesAtom = serverRuntime.fn<DeleteScope>()(
  Effect.fnUntraced(function* (olderThanDays, get) {
    const client = yield* ServerClient
    const deleted = yield* client["transcript.deleteImages"](
      olderThanDays === null ? {} : { olderThanDays },
    )
    get.set(
      deletedImageIdsAtom,
      new Map([...get(deletedImageIdsAtom), ...deleted.imageIds.map((id) => [id, true] as const)]),
    )
    get.set(imagesDeletedAtom, get(imagesDeletedAtom) + 1)
    return deleted
  }),
)
