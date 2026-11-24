import { useCallback, useLayoutEffect, useRef } from "react"
import type { VirtuosoHandle } from "react-virtuoso"
import { lastTurnMessageId, type TranscriptRow } from "../rules/turns.ts"

const END_SLACK = 2
// A scroll this long after a key, a touch or a wheel turn is the user's, not a row that changed size.
const USER_SCROLL_MS = 300
// The glide stays under two lines behind the end, so the line being written stays in view.
const MAX_LAG = 40
const MIN_GROWTH_GAP_MS = 50
const FIRST_GROWTH_GAP_MS = 150
// A longer wait between two growths is a pause, not the pace of the stream.
const MAX_GROWTH_GAP_MS = 500

const UP_KEYS = new Set(["ArrowUp", "PageUp", "Home"])

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches

const readingPlace = (view: HTMLElement) => {
  const viewTop = view.getBoundingClientRect().top
  for (const row of view.querySelectorAll("[data-index]")) {
    const box = row.getBoundingClientRect()
    if (box.bottom > viewTop)
      return { row, top: box.top - viewTop, scrollTop: view.scrollTop, height: view.scrollHeight }
  }
  return null
}

const rowTop = (view: HTMLElement, id: string) => {
  const row = view.querySelector(`[data-row-id="${CSS.escape(id)}"]`)
  return row && row.getBoundingClientRect().top - view.getBoundingClientRect().top
}

// `rows` are all the rows, to find the last turn's message; `shown` are the ones the list draws.
export function useFollowTranscript({
  rows,
  shown,
  live,
  following,
  list,
}: {
  rows: ReadonlyArray<TranscriptRow>
  shown: ReadonlyArray<TranscriptRow>
  live: boolean
  following: React.RefObject<boolean>
  list: React.RefObject<VirtuosoHandle | null>
}) {
  const scroller = useRef<HTMLElement | null>(null)
  // Set when a turn ends while followed: the view then keeps the turn's message at its top.
  const anchor = useRef<string | undefined>(undefined)
  const userAt = useRef(Number.NEGATIVE_INFINITY)
  const scrollbarHeld = useRef(false)
  const lastTop = useRef(0)
  const frame = useRef(0)
  const glide = useRef({
    end: 0,
    grewAt: Number.NEGATIVE_INFINITY,
    gap: FIRST_GROWTH_GAP_MS,
    speed: 0,
  })
  const reading = useRef<ReturnType<typeof readingPlace>>(null)
  const latest = useRef({ rows, shown })
  latest.current = { rows, shown }

  const stopGlide = () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
  }

  const stopFollowing = () => {
    following.current = false
    anchor.current = undefined
    stopGlide()
    if (scroller.current) reading.current = readingPlace(scroller.current)
  }

  const glideToEnd = (view: HTMLElement) => {
    const end = () => view.scrollHeight - view.clientHeight
    if (reducedMotion() || end() - view.scrollTop > view.clientHeight) {
      stopGlide()
      view.scrollTop = end()
      glide.current.end = end()
      return
    }
    if (frame.current) return
    let last = performance.now()
    const step = (now: number) => {
      const state = glide.current
      const target = end()
      if (target > state.end + 0.5) {
        const gap = now - state.grewAt
        if (gap <= MAX_GROWTH_GAP_MS) state.gap = Math.max(MIN_GROWTH_GAP_MS, (state.gap + gap) / 2)
        state.grewAt = now
        // Covers the way left by the time the next growth is due, so a steady stream moves steadily.
        state.speed = (target - view.scrollTop) / state.gap
      }
      state.end = target
      const remaining = target - view.scrollTop
      if (!following.current || remaining < 1) {
        frame.current = 0
        if (following.current) view.scrollTop = target
        return
      }
      // A move under a pixel can round to none and never arrive.
      const moved = Math.max(1, state.speed * (now - last))
      last = now
      view.scrollTop = Math.max(view.scrollTop + moved, target - MAX_LAG)
      frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }

  // Virtuoso shifts the view by what a row that starts above it grows, even when it grows below the view.
  const keepReadingPlace = (view: HTMLElement) => {
    const place = reading.current
    if (!place?.row.isConnected) return
    const shifted = view.scrollTop - place.scrollTop
    const grown = view.scrollHeight - place.height
    const moved =
      place.row.getBoundingClientRect().top - view.getBoundingClientRect().top - place.top
    // Any other move is the user's, whose scroll event has not come yet.
    if (shifted === 0 || Math.abs(shifted - grown) >= 1 || Math.abs(moved) < 1) return
    view.scrollTop += moved
    reading.current = readingPlace(view)
  }

  const placeAnchor = (view: HTMLElement, id: string, index: number) => {
    stopGlide()
    const top = rowTop(view, id)
    if (top === null) {
      list.current?.scrollToIndex({ index, align: "start" })
      return
    }
    // Virtuoso's offsets are estimates until it measures the rows; the page's are not.
    // Past the end the view stops at the end, so a short answer stays at the end with its message.
    if (Math.abs(top) > 1) view.scrollTop += top
    // At the top the view no longer follows the end, so closing the transcript saves this place.
    if (Math.abs(rowTop(view, id) ?? Number.POSITIVE_INFINITY) <= 1) following.current = false
  }

  const settle = () => {
    const view = scroller.current
    if (!view) return
    const id = anchor.current
    const index = id === undefined ? -1 : latest.current.shown.findIndex((row) => row.id === id)
    if (id !== undefined && index >= 0) placeAnchor(view, id, index)
    else {
      anchor.current = undefined
      if (following.current) glideToEnd(view)
      else keepReadingPlace(view)
    }
  }

  const placing = useRef(0)
  const onScroll = useCallback(() => {
    const view = scroller.current
    if (!view) return
    const atEnd = view.scrollHeight - view.clientHeight - view.scrollTop < END_SLACK
    // The glide only moves down, so a move up is the user's or a shorter list.
    const up = view.scrollTop < lastTop.current - 1
    lastTop.current = view.scrollTop
    const byUser = scrollbarHeld.current || performance.now() - userAt.current < USER_SCROLL_MS
    if (anchor.current !== undefined) {
      // The anchor holds until the user scrolls: Virtuoso moves the view as it measures the rows above.
      if (byUser) stopFollowing()
      // Virtuoso draws the rows of a jump on its scroll event; the anchor is placed once they are drawn.
      else if (!placing.current)
        placing.current = requestAnimationFrame(() => {
          placing.current = 0
          settle()
        })
    }
    if (atEnd) {
      if (anchor.current === undefined) following.current = true
    } else if (up && byUser) {
      stopFollowing()
    }
    reading.current = following.current ? null : readingPlace(view)
  }, [])

  // The scroll event comes a frame after the wheel; a row growing in between would pull the view back.
  const onWheel = useCallback((event: WheelEvent) => {
    userAt.current = performance.now()
    if (event.deltaY < 0) stopFollowing()
  }, [])
  // A touch drag scrolls either way; reaching the end again follows again.
  const onTouch = useCallback(() => {
    userAt.current = performance.now()
    stopFollowing()
  }, [])
  // Like the wheel, a key or a touch must stop following before a growing row pulls the view back.
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    userAt.current = performance.now()
    if (UP_KEYS.has(event.key) || (event.key === " " && event.shiftKey)) stopFollowing()
  }, [])
  const onPointerDown = useCallback((event: PointerEvent) => {
    if (event.target === scroller.current) scrollbarHeld.current = true
  }, [])
  const onPointerUp = useCallback(() => {
    scrollbarHeld.current = false
  }, [])
  // Folding or unfolding never moves the view.
  const onClick = useCallback((event: MouseEvent) => {
    if ((event.target as Element).closest("[aria-expanded]")) stopFollowing()
  }, [])

  const resizes = useRef<ResizeObserver | null>(null)
  const watchedFooter = useRef<Element | null>(null)
  // The list's height comes from Virtuoso once it has measured the rows; the footer is watched here.
  const watchFooter = () => {
    const footer = scroller.current?.querySelector(".iv-transcript__footer")?.parentElement
    if (!footer || footer === watchedFooter.current) return
    if (watchedFooter.current) resizes.current?.unobserve(watchedFooter.current)
    watchedFooter.current = footer
    resizes.current?.observe(footer, { box: "border-box" })
  }
  const scrollerRef = useCallback(
    (element: HTMLElement | Window | null) => {
      const previous = scroller.current
      previous?.removeEventListener("scroll", onScroll)
      previous?.removeEventListener("wheel", onWheel)
      previous?.removeEventListener("touchmove", onTouch)
      previous?.removeEventListener("keydown", onKeyDown)
      previous?.removeEventListener("pointerdown", onPointerDown)
      previous?.removeEventListener("click", onClick)
      window.removeEventListener("pointerup", onPointerUp)
      resizes.current?.disconnect()
      stopGlide()
      scroller.current = element instanceof HTMLElement ? element : null
      const view = scroller.current
      if (!view) return
      view.addEventListener("scroll", onScroll)
      view.addEventListener("wheel", onWheel, { passive: true })
      view.addEventListener("touchmove", onTouch, { passive: true })
      view.addEventListener("keydown", onKeyDown)
      view.addEventListener("pointerdown", onPointerDown)
      view.addEventListener("click", onClick)
      window.addEventListener("pointerup", onPointerUp)
      resizes.current = new ResizeObserver(settle)
      watchedFooter.current = null
      watchFooter()
    },
    [onScroll, onWheel, onTouch, onKeyDown, onPointerDown, onPointerUp, onClick],
  )

  const turn = lastTurnMessageId(rows)
  const previousTurn = useRef(turn)
  useLayoutEffect(() => {
    const sent = previousTurn.current !== undefined && previousTurn.current !== turn
    previousTurn.current = turn
    if (!sent) return
    // A message sent while scrolled up still shows its answer.
    const wasFollowing = following.current
    following.current = true
    anchor.current = undefined
    if (wasFollowing) settle()
    else list.current?.scrollToIndex({ index: "LAST", align: "end" })
  }, [turn, list])

  const wasLive = useRef(live)
  useLayoutEffect(() => {
    if (wasLive.current && !live && following.current) anchor.current = lastTurnMessageId(rows)
    wasLive.current = live
    watchFooter()
    settle()
  }, [rows, live])

  return { scrollerRef, totalListHeightChanged: settle }
}
