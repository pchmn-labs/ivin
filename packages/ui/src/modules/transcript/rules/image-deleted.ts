import type { ImageRef } from "@ivin/contracts/transcript"

export const isImageDeleted = (image: ImageRef, deletedIds: ReadonlyMap<string, true>) =>
  image.deleted === true || deletedIds.has(image.id)
