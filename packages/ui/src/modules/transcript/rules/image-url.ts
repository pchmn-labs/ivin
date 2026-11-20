import type { ImageData, ImageMediaType, ImageRef } from "@ivin/contracts/transcript"

const EXTENSIONS: Record<ImageMediaType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

// The server writes the file under the same name (`image-file-name.ts`); the desktop app serves it.
export const storedImageUrl = (sessionId: string, image: Pick<ImageRef, "id" | "mediaType">) =>
  `ivin-image://${sessionId}/${image.id}.${EXTENSIONS[image.mediaType]}`

export const imageDataUrl = ({ mediaType, base64 }: Pick<ImageData, "mediaType" | "base64">) =>
  `data:${mediaType};base64,${base64}`
