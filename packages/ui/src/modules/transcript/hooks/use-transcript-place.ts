import { RegistryContext } from "@effect/atom-react"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import type { VirtuosoHandle } from "react-virtuoso"
import { transcriptOf } from "../atoms/get-items.ts"
import { placeToRestore, type SentMessagePlace } from "../rules/transcript-place.ts"

const END_SLACK = 2

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

export function useSavePlace({
  sessionId,
  firstIndex,
  sentMessagePlace,
}: {
  sessionId: string
  firstIndex: number
  sentMessagePlace: () => SentMessagePlace | undefined
}) {
  const registry = useContext(RegistryContext)
  // React clears the list's ref before the effects' cleanup runs, so this keeps the last one.
  const list = useRef<VirtuosoHandle | null>(null)
  const scroller = useRef<HTMLElement | null>(null)
  const atEnd = useRef(true)
  const latest = useRef({ firstIndex, sentMessagePlace })
  latest.current = { firstIndex, sentMessagePlace }

  useEffect(
    () => () => {
      const { firstIndex, sentMessagePlace } = latest.current
      const sent = sentMessagePlace()
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

  const onScroll = useCallback(() => {
    const view = scroller.current
    if (view) atEnd.current = view.scrollHeight - view.clientHeight - view.scrollTop < END_SLACK
  }, [])
  const listRef = useCallback((handle: VirtuosoHandle | null) => {
    if (handle) list.current = handle
  }, [])
  // A detached scroller has no layout left to measure, so the end is tracked as the user scrolls.
  const scrollerRef = useCallback(
    (element: HTMLElement | null) => {
      scroller.current?.removeEventListener("scroll", onScroll)
      scroller.current = element
      element?.addEventListener("scroll", onScroll)
    },
    [onScroll],
  )
  return { listRef, scrollerRef }
}
