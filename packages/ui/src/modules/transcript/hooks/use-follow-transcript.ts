import { useCallback, useLayoutEffect, useRef } from "react"
import type { VirtuosoHandle } from "react-virtuoso"
import { lastTurnMessageId, type TranscriptRow } from "../rules/turns.ts"

const END_SLACK = 2
// A scroll this long after a key, a touch or a wheel turn is the user's, not a row that changed size.
const USER_SCROLL_MS = 300
// The glide covers 95% of the way in three times this.
const GLIDE_MS = 50

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches

// The first row drawn under the top of the view, and how far below that top it starts.
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
  // Set when a turn ends while followed: the view then stops with the turn's message at its top.
  const anchor = useRef<string | undefined>(undefined)
  const userAt = useRef(Number.NEGATIVE_INFINITY)
  const scrollbarHeld = useRef(false)
  const lastTop = useRef(0)
  const frame = useRef(0)
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
      return
    }
    if (frame.current) return
    let last = performance.now()
    const step = (now: number) => {
      const remaining = end() - view.scrollTop
      if (!following.current || remaining < 1) {
        frame.current = 0
        if (following.current) view.scrollTop = end()
        return
      }
      const moved = remaining * (1 - Math.exp(-(now - last) / GLIDE_MS))
      last = now
      // A move under a pixel can round to none and never arrive.
      view.scrollTop += Math.max(1, moved)
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

  const settle = () => {
    const view = scroller.current
    if (!view) return
    if (!following.current) {
      keepReadingPlace(view)
      return
    }
    const id = anchor.current
    const index = id === undefined ? -1 : latest.current.shown.findIndex((row) => row.id === id)
    if (id === undefined || index < 0) {
      anchor.current = undefined
      glideToEnd(view)
      return
    }
    const top = rowTop(view, id)
    if (top !== null && Math.abs(top) <= 1) {
      stopFollowing()
      return
    }
    stopGlide()
    // Past the end Virtuoso stops at the end, so a short answer stays at the end with its message.
    list.current?.scrollToIndex({ index, align: "start" })
  }

  const onScroll = useCallback(() => {
    const view = scroller.current
    if (!view) return
    const atEnd = view.scrollHeight - view.clientHeight - view.scrollTop < END_SLACK
    // The glide only moves down, so a move up is the user's or a shorter list.
    const up = view.scrollTop < lastTop.current - 1
    lastTop.current = view.scrollTop
    const byUser = scrollbarHeld.current || performance.now() - userAt.current < USER_SCROLL_MS
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
  const onInput = useCallback(() => {
    userAt.current = performance.now()
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
      previous?.removeEventListener("touchmove", onInput)
      previous?.removeEventListener("keydown", onInput)
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
      view.addEventListener("touchmove", onInput, { passive: true })
      view.addEventListener("keydown", onInput)
      view.addEventListener("pointerdown", onPointerDown)
      view.addEventListener("click", onClick)
      window.addEventListener("pointerup", onPointerUp)
      resizes.current = new ResizeObserver(settle)
      watchedFooter.current = null
      watchFooter()
    },
    [onScroll, onWheel, onInput, onPointerDown, onPointerUp, onClick],
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
