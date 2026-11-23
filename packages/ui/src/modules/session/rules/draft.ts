import type { Draft, DraftImage } from "@ivin/plugin-api/ui"
import { messageParts } from "../../transcript/rules/message-parts.ts"

export const emptyDraft: Draft = { text: "", images: [] }

export const draftImages = (draft: Draft): ReadonlyArray<DraftImage> => {
  const marked = messageParts(draft.text, draft.images).flatMap((part) =>
    part.type === "image" ? [part.image] : [],
  )
  return [...new Set(marked)]
}

export const nextImageNumber = (lastImageNumber: number, draft: Draft) =>
  Math.max(lastImageNumber, ...draft.images.map((image) => image.number)) + 1
