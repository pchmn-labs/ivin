import type { ImageData, ImageRef } from "@ivin/contracts/transcript"
import { imageDataUrl, storedImageUrl } from "../rules/image-url.ts"

// A message's images show at once, before the server has written their files, until its send ends.
const sent = new Map<string, string>()

export const rememberSentImages = (images: ReadonlyArray<ImageData>) => {
  for (const image of images) sent.set(image.id, imageDataUrl(image))
}

export const forgetSentImages = (images: ReadonlyArray<ImageData>) => {
  for (const image of images) sent.delete(image.id)
}

export const imageSrc = (sessionId: string, image: Pick<ImageRef, "id" | "mediaType">) =>
  sent.get(image.id) ?? storedImageUrl(sessionId, image)
