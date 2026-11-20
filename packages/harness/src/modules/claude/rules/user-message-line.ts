import type { ImageData } from "@ivin/contracts/transcript"
import type { UserMessage } from "../../../shared/harness-provider.ts"

const MARKER = /\[Image #(\d+)\]/g

const imageBlock = ({ mediaType, base64 }: ImageData) => ({
  type: "image",
  source: { type: "base64", media_type: mediaType, data: base64 },
})

const contentOf = ({ text, images }: UserMessage) => {
  const byNumber = new Map(images.map((image) => [image.number, image]))
  const placed = new Set<ImageData>()
  const blocks: unknown[] = []
  let pending = ""
  let at = 0
  for (const match of text.matchAll(MARKER)) {
    const image = byNumber.get(Number(match[1]))
    const end = match.index + match[0].length
    pending += text.slice(at, end)
    at = end
    if (!image || placed.has(image)) continue
    blocks.push({ type: "text", text: pending }, imageBlock(image))
    placed.add(image)
    pending = ""
  }
  pending += text.slice(at)
  // Claude refuses an empty text block.
  if (pending !== "") blocks.push({ type: "text", text: pending })
  return [...images.filter((image) => !placed.has(image)).map(imageBlock), ...blocks]
}

export const userMessageLine = (message: UserMessage): string =>
  JSON.stringify({ type: "user", message: { role: "user", content: contentOf(message) } })
