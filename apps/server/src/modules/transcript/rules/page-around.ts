import type { TranscriptItem, TranscriptPage } from "@ivin/contracts/transcript"

// `before` items come from the anchor backwards, `after` from the anchor onwards, the anchor included.
export const pageAround = (
  items: readonly TranscriptItem[],
  position: number | null,
  before: number,
  after: number,
): TranscriptPage => {
  const found = position === null ? -1 : items.findIndex((item) => item.position >= position)
  const anchor = found === -1 ? items.length : found
  const start = Math.max(0, anchor - before)
  const end = Math.min(items.length, anchor + after)
  return { items: items.slice(start, end), hasBefore: start > 0, hasAfter: end < items.length }
}
