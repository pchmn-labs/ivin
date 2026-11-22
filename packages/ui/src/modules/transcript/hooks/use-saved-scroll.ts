import { RegistryContext } from "@effect/atom-react"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import type { VirtuosoHandle } from "react-virtuoso"
import { transcriptOf } from "../atoms/get-items.ts"
import { placeToRestore, type SentMessagePlace } from "../rules/transcript-place.ts"

// Read once, when the view opens: the place applies to the rows shown first.
export function useRestoredScroll({
  sessionId,
  loaded,
  firstIndex,
}: {
  sessionId: string
  loaded: boolean
  firstIndex: number
}) {
  const registry = useContext(RegistryContext)
  const [restored] = useState(() =>
    loaded ? placeToRestore(registry.get(transcriptOf(sessionId).place), firstIndex) : undefined,
  )
  return restored
}

export function useSaveScroll({
  sessionId,
  firstIndex,
  sentPlace,
}: {
  sessionId: string
  firstIndex: number
  sentPlace: () => SentMessagePlace | undefined
}) {
  const registry = useContext(RegistryContext)
  // React clears the list's ref before the effects' cleanup runs, so this keeps the last one.
  const list = useRef<VirtuosoHandle | null>(null)
  const atEnd = useRef(true)
  const latest = useRef({ firstIndex, sentPlace })
  latest.current = { firstIndex, sentPlace }

  useEffect(
    () => () => {
      const { firstIndex, sentPlace } = latest.current
      const sent = sentPlace()
      list.current?.getState((state) =>
        registry.set(transcriptOf(sessionId).place, {
          firstIndex,
          atEnd: atEnd.current,
          list: state,
          sent,
        }),
      )
    },
    [registry, sessionId],
  )

  const listRef = useCallback((handle: VirtuosoHandle | null) => {
    if (handle) list.current = handle
  }, [])
  const atBottomStateChange = useCallback((atBottom: boolean) => {
    atEnd.current = atBottom
  }, [])
  return { listRef, atBottomStateChange }
}
