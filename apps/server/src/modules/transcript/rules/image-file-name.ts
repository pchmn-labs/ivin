import type { ImageMediaType } from "@ivin/contracts/transcript"

const EXTENSIONS: Record<ImageMediaType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

// The renderer builds the same name into its `ivin-image://` URL.
export const imageFileName = (imageId: string, mediaType: ImageMediaType) =>
  `${imageId}.${EXTENSIONS[mediaType]}`
