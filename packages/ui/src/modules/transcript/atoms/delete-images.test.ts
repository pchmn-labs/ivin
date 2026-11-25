import { AsyncResult } from "effect/reactivity"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { deleteImagesAtom, deletedImageIdsAtom } from "./delete-images.ts"
import { imageSpaceOf } from "./get-image-space.ts"

test("deleting images refreshes the space and remembers which images went, for the transcripts already loaded", async () => {
  const { registry, server } = makeTestRegistry()
  server.seedStoredImages([
    { id: "old", bytes: 2_000, sentAt: Date.now() - 40 * 86_400_000 },
    { id: "new", bytes: 1_000, sentAt: Date.now() },
  ])
  registry.mount(imageSpaceOf(null))
  registry.mount(deleteImagesAtom)
  await vi.waitFor(() =>
    expect(AsyncResult.getOrElse(registry.get(imageSpaceOf(null)), () => null)).toEqual({
      images: 2,
      bytes: 3_000,
    }),
  )

  registry.set(deleteImagesAtom, 30)

  await vi.waitFor(() =>
    expect(AsyncResult.getOrElse(registry.get(imageSpaceOf(null)), () => null)).toEqual({
      images: 1,
      bytes: 1_000,
    }),
  )
  expect([...registry.get(deletedImageIdsAtom).keys()]).toEqual(["old"])
})
