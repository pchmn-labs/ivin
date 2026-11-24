import { useCallback, useLayoutEffect, useRef } from "react"
import type { VirtuosoHandle } from "react-virtuoso"
import { lastTurnMessageId, type TranscriptRow } from "../rules/turns.ts"

const END_SLACK = 2
const USER_SCROLL_EVENTS = ["wheel", "touchmove", "keydown", "pointerdown"] as const

const freshTurn = (turn: string | undefined) => ({
  turn,
  drawn: false,
  // Where the message was while below the top of the view; Virtuoso unmounts its row once above it.
  contentTop: undefined as number | undefined,
  stopped: false,
  away: false,
})

// Follows the transcript's end, except once the last turn's user message has reached the top of the view.
export function useFollowSentMessage({
  rows,
  list,
}: {
  rows: ReadonlyArray<TranscriptRow>
  list: React.RefObject<VirtuosoHandle | null>
}) {
  const scroller = useRef<HTMLElement | null>(null)
  const turn = lastTurnMessageId(rows)
  const state = useRef(freshTurn(turn))
  const latestTurn = useRef(turn)
  latestTurn.current = turn

  const sync = () => {
    if (state.current.turn !== latestTurn.current) state.current = freshTurn(latestTurn.current)
    return state.current
  }

  const top = (view: HTMLElement, id: string) => {
    const row = view.querySelector(`[data-row-id="${CSS.escape(id)}"]`)
    return row && row.getBoundingClientRect().top - view.getBoundingClientRect().top
  }

  const stopIfReached = (view: HTMLElement, snap: boolean) => {
    const current = sync()
    if (current.turn === undefined || current.stopped) return
    const rowTop = top(view, current.turn)
    if (rowTop !== null) {
      current.drawn = true
      if (rowTop > 0) current.contentTop = view.scrollTop + rowTop
    }
    // Virtuoso unmounts the row once it is out of view, so a row seen before and gone has gone above.
    current.stopped = rowTop === null ? current.drawn : rowTop <= 0
    // A row that arrives taller than the view is followed in one jump, past the message.
    if (snap && current.stopped && current.contentTop !== undefined) {
      view.scrollTop = Math.min(view.scrollTop, current.contentTop)
    }
  }

  const onScroll = useCallback(() => {
    const view = scroller.current
    if (!view) return
    const current = sync()
    const atEnd = view.scrollHeight - view.clientHeight - view.scrollTop < END_SLACK
    if (atEnd && current.away) {
      // Back at the end after scrolling away: follow again, however far up the message is.
      current.away = false
      current.stopped = false
      current.drawn = false
    }
    stopIfReached(view, true)
  }, [])

  // Only the user moves the view away: a row that grows before Virtuoso follows it also leaves the end.
  const onUserScroll = useCallback(() => {
    sync().away = true
  }, [])

  const previousTurn = useRef(turn)
  useLayoutEffect(() => {
    if (scroller.current) stopIfReached(scroller.current, false)
  }, [rows])

  useLayoutEffect(() => {
    const sentAfterOpening = previousTurn.current !== undefined && previousTurn.current !== turn
    previousTurn.current = turn
    // A message sent while scrolled up still shows its answer.
    if (sentAfterOpening) list.current?.scrollToIndex({ index: "LAST", align: "end" })
  }, [turn, list])

  const scrollerRef = useCallback(
    (element: HTMLElement | Window | null) => {
      scroller.current?.removeEventListener("scroll", onScroll)
      for (const type of USER_SCROLL_EVENTS)
        scroller.current?.removeEventListener(type, onUserScroll)
      scroller.current = element instanceof HTMLElement ? element : null
      scroller.current?.addEventListener("scroll", onScroll)
      for (const type of USER_SCROLL_EVENTS) scroller.current?.addEventListener(type, onUserScroll)
    },
    [onScroll, onUserScroll],
  )

  // A new function each render re-arms Virtuoso's scroll to the end for a row that grows once measured.
  const followOutput = (atBottom: boolean) => {
    const view = scroller.current
    const current = sync()
    if (view) stopIfReached(view, false)
    return atBottom && !current.stopped && ("auto" as const)
  }

  return { scrollerRef, followOutput }
}
