import type { ImageRef } from "@ivin/contracts/transcript"

export type MessagePart<I extends ImageRef = ImageRef> =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image"; readonly image: I }

const MARKER = /\[Image #(\d+)\]/g

export const imageMarker = (number: number) => `[Image #${number}]`

export const messageParts = <I extends ImageRef>(
  text: string,
  images: ReadonlyArray<I>,
): ReadonlyArray<MessagePart<I>> => {
  const parts: Array<MessagePart<I>> = []
  let at = 0
  for (const match of text.matchAll(MARKER)) {
    if (match.index > at) parts.push({ type: "text", text: text.slice(at, match.index) })
    const image = images.find((candidate) => candidate.number === Number(match[1]))
    parts.push(image ? { type: "image", image } : { type: "text", text: match[0] })
    at = match.index + match[0].length
  }
  if (at < text.length) parts.push({ type: "text", text: text.slice(at) })
  return parts
}
