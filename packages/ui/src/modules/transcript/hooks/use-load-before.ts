import { useEffect, useRef } from "react"
import type { TranscriptRow } from "../rules/turns.ts"

const oldestItemId = (rows: ReadonlyArray<TranscriptRow>) => {
  const first = rows[0]
  return first?.type === "work" ? first.turnIds[0] : first?.id
}

// Loads older items when the list's first row comes into view, page after page while it stays there.
export function useLoadBefore({
  rows,
  firstIndex,
  hasBefore,
  load,
}: {
  rows: ReadonlyArray<TranscriptRow>
  firstIndex: number
  hasBefore: boolean
  load: () => void
}) {
  const loading = useRef(false)
  const shownFrom = useRef<number | null>(null)
  const oldest = oldestItemId(rows)

  // A page that only lengthens the first row keeps it in view, and startReached fires once per first row.
  useEffect(() => {
    if (!loading.current) return
    if (hasBefore && shownFrom.current === firstIndex) load()
    else loading.current = false
  }, [oldest])

  return {
    rangeChanged: (range: { startIndex: number }) => {
      shownFrom.current = range.startIndex
    },
    startReached: () => {
      if (!hasBefore) return
      loading.current = true
      load()
    },
  }
}
