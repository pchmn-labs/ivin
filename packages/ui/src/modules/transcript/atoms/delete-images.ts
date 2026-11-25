import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { type DeleteScope, imageSelectionOf } from "../rules/image-space.ts"
import { imagesDeletedAtom } from "./get-image-space.ts"

export const deletedImageIdsAtom = Atom.make<ReadonlyMap<string, true>>(new Map()).pipe(
  Atom.keepAlive,
)

export const deleteImagesAtom = serverRuntime.fn<DeleteScope>()(
  Effect.fnUntraced(function* (scope, get) {
    const client = yield* ServerClient
    const deleted = yield* client["transcript.deleteImages"](imageSelectionOf(scope))
    get.set(
      deletedImageIdsAtom,
      new Map([...get(deletedImageIdsAtom), ...deleted.imageIds.map((id) => [id, true] as const)]),
    )
    get.set(imagesDeletedAtom, get(imagesDeletedAtom) + 1)
    return deleted
  }),
)
