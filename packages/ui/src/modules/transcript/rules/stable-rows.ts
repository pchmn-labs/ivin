import type { TranscriptRow } from "./turns.ts"

interface Shown {
  readonly rows: ReadonlyArray<TranscriptRow>
  // Rows added above the first one shown; the virtual list needs it to keep its scroll anchor.
  readonly prepended: number
}

const sameIds = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((id, i) => id === b[i])

const sameRow = (a: TranscriptRow, b: TranscriptRow) =>
  a.type === "item" || b.type === "item"
    ? a.type === b.type && a.id === b.id
    : a.id === b.id &&
      sameIds(a.itemIds, b.itemIds) &&
      sameIds(a.turnIds, b.turnIds) &&
      sameIds(a.answerIds, b.answerIds)

// Keeps each unchanged row, and the whole value when no row changed.
export const stableRows = (previous: Shown, next: ReadonlyArray<TranscriptRow>): Shown => {
  const before = new Map(previous.rows.map((row, index) => [row.id, { row, index }]))
  let changed = next.length !== previous.rows.length
  const rows = next.map((row, index) => {
    const kept = before.get(row.id)
    if (kept && sameRow(kept.row, row)) {
      if (kept.index !== index) changed = true
      return kept.row
    }
    changed = true
    return row
  })
  if (!changed) return previous
  const firstKept = previous.rows.findIndex((row) => rows.some((r) => r.id === row.id))
  const shift =
    firstKept < 0 ? 0 : rows.findIndex((r) => r.id === previous.rows[firstKept]!.id) - firstKept
  return { rows, prepended: previous.prepended + Math.max(0, shift) }
}
