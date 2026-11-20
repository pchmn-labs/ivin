import type { ImageData } from "@ivin/contracts/transcript"
import { messageParts } from "../../transcript/rules/message-parts.ts"

export interface DraftImage extends ImageData {
  readonly name: string
}

// `images` keeps every image pasted since the last send, so undoing a deleted marker brings its image back.
export interface Draft {
  readonly text: string
  readonly images: ReadonlyArray<DraftImage>
}

export const emptyDraft: Draft = { text: "", images: [] }

export const draftImages = (draft: Draft): ReadonlyArray<DraftImage> => {
  const marked = messageParts(draft.text, draft.images).flatMap((part) =>
    part.type === "image" ? [part.image] : [],
  )
  return [...new Set(marked)]
}

export const nextImageNumber = (lastImageNumber: number, draft: Draft) =>
  Math.max(lastImageNumber, ...draft.images.map((image) => image.number)) + 1
