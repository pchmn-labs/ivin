import { useEffect, useRef } from "react"

// Loads older items when the list's first row comes into view, page after page while it stays there.
export function useLoadBefore({
  oldestId,
  firstIndex,
  hasBefore,
  load,
}: {
  // The oldest item loaded, whether a row shows it or not.
  oldestId: string | undefined
  firstIndex: number
  hasBefore: boolean
  load: () => void
}) {
  const loading = useRef(false)
  const shownFrom = useRef<number | null>(null)
  // A page that adds no row keeps the first row in view, and startReached fires once per first row.
  useEffect(() => {
    if (!loading.current) return
    if (hasBefore && shownFrom.current === firstIndex) load()
    else loading.current = false
  }, [oldestId])

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
