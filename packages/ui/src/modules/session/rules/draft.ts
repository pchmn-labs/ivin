import type { Draft, DraftImage } from "@ivin/plugin-api/ui"
import { imageMarker, messageParts } from "../../transcript/rules/message-parts.ts"

export const emptyDraft: Draft = { text: "", images: [] }

export const draftImages = (draft: Draft): ReadonlyArray<DraftImage> => {
  const marked = messageParts(draft.text, draft.images).flatMap((part) =>
    part.type === "image" ? [part.image] : [],
  )
  return [...new Set(marked)]
}

export const nextImageNumber = (lastImageNumber: number, draft: Draft) =>
  Math.max(lastImageNumber, ...draft.images.map((image) => image.number)) + 1

export interface UnreadMessage {
  readonly text: string
  // `image` is null when its file could not be read.
  readonly images: ReadonlyArray<{ readonly number: number; readonly image: DraftImage | null }>
}

// Unread images keep the number their message had; the draft's own markers and images win the clash.
export const withUnreadMessages = (
  draft: Draft,
  lastImageNumber: number,
  messages: ReadonlyArray<UnreadMessage>,
): Draft => {
  let number = nextImageNumber(lastImageNumber, draft)
  const added: Array<DraftImage> = []
  const texts = messages.map((message) => {
    const renumbered = new Map<number, number>()
    for (const { number: old, image } of message.images) {
      if (image === null) continue
      renumbered.set(old, number)
      added.push({ ...image, number: number++ })
    }
    const unmarked = message.images.flatMap(({ number: old }) =>
      renumbered.has(old) && !message.text.includes(imageMarker(old)) ? [old] : [],
    )
    const text = message.text.replace(/\[Image #(\d+)\]/g, (marker, old: string) => {
      const next = renumbered.get(Number(old))
      return next === undefined ? "" : imageMarker(next)
    })
    return [text, ...unmarked.map((old) => imageMarker(renumbered.get(old)!))]
      .filter((part) => part !== "")
      .join(" ")
  })
  const unread = texts.join("\n\n")
  return {
    text: draft.text === "" ? unread : `${draft.text}\n\n${unread}`,
    images: [...draft.images, ...added],
  }
}

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ""
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  }
  return btoa(binary)
}
