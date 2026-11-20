import type { ImageFile } from "@ivin/contracts/transcript"

export const imageDataUrl = ({ mediaType, base64 }: ImageFile) =>
  `data:${mediaType};base64,${base64}`
