import { RegistryContext } from "@effect/atom-react"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import type { VirtuosoHandle } from "react-virtuoso"
import { transcriptOf } from "../atoms/get-items.ts"
import { trimTranscriptAtom } from "../atoms/trim-transcript.ts"
import { placeToRestore } from "../rules/transcript-place.ts"

export function useRestoredPlace({
  sessionId,
  loaded,
  firstIndex,
}: {
  sessionId: string
  loaded: boolean
  firstIndex: number
}) {
  const registry = useContext(RegistryContext)
  // Read once: the place applies to the rows the view opens with.
  const [restored] = useState(() =>
    loaded ? placeToRestore(registry.get(transcriptOf(sessionId).place), firstIndex) : undefined,
  )
  return restored
}

// `following`, not the scroll position: a glide toward the end may not have reached it yet.
export function useSavePlace({
  sessionId,
  firstIndex,
  following,
}: {
  sessionId: string
  firstIndex: number
  following: React.RefObject<boolean>
}) {
  const registry = useContext(RegistryContext)
  // React clears the list's ref before the effects' cleanup runs, so this keeps the last one.
  const list = useRef<VirtuosoHandle | null>(null)
  const latestFirstIndex = useRef(firstIndex)
  latestFirstIndex.current = firstIndex

  useEffect(
    () => () => {
      list.current?.getState((state) => {
        const place = {
          firstIndex: latestFirstIndex.current,
          atEnd: following.current,
          list: state,
        }
        registry.set(transcriptOf(sessionId).place, place)
        // Reopening at the end needs only the last page; a place scrolled back keeps what it has.
        if (place.atEnd) registry.set(trimTranscriptAtom, sessionId)
      })
    },
    [registry, sessionId, following],
  )

  const listRef = useCallback((handle: VirtuosoHandle | null) => {
    if (handle) list.current = handle
  }, [])
  return { list, listRef }
}
