import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  initialSentMessageScroll,
  mayFollowEnd,
  needsMeasurement,
  nextSentMessageScroll,
  sentMessagePlace as placeOf,
  turnChanged,
  type Measurement,
  type SentMessageEvent,
  type SentMessagePlace,
  type SentMessageScrollAction,
} from "../rules/sent-message-scroll.ts"
import { lastTurnMessageId, type TranscriptRow } from "../rules/turns.ts"

// --iv-ease-out, cubic-bezier(0.22, 1, 0.36, 1), approximated as an ease-out quint.
const easeOut = (t: number) => 1 - (1 - t) ** 5

const cssMs = (element: Element, token: string) =>
  Number.parseFloat(getComputedStyle(element).getPropertyValue(token)) || 0

const USER_SCROLL_EVENTS = ["wheel", "touchmove", "keydown", "pointerdown"] as const

const contentTop = (view: HTMLElement, element: Element) =>
  view.scrollTop + element.getBoundingClientRect().top - view.getBoundingClientRect().top

const minHeight = (footer: HTMLElement | null | undefined) =>
  footer ? Number.parseFloat(getComputedStyle(footer).minHeight) : 0

// Scrolls a message the user sends to the top of the transcript, with room under it for the answer.
export function useSentMessageScroll({
  loaded,
  rows,
  restored,
}: {
  loaded: boolean
  rows: ReadonlyArray<TranscriptRow>
  restored?: SentMessagePlace | undefined
}) {
  const root = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLElement | null>(null)
  const model = useRef(initialSentMessageScroll)
  const frame = useRef(0)
  // Re-renders with the followOutput the model allows.
  const [, setRoomLeft] = useState(false)

  const turnMessageId = lastTurnMessageId(rows)

  const footer = () => root.current?.querySelector<HTMLElement>(".iv-transcript__footer")

  const sentRow = (view: HTMLElement) => {
    const id = model.current.sent?.id
    return id ? view.querySelector(`[data-row-id="${CSS.escape(id)}"]`) : null
  }

  const measure = (): Measurement | undefined => {
    const view = scroller.current
    const end = footer()
    if (!view || !end) return undefined
    const row = sentRow(view)
    return {
      viewHeight: view.clientHeight,
      footerTop: contentTop(view, end),
      footerMinHeight: minHeight(end),
      messageTop: row ? contentTop(view, row) : undefined,
    }
  }

  const animateToMessage = (view: HTMLElement) => {
    cancelAnimationFrame(frame.current)
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : cssMs(view, "--iv-duration-base")
    const from = view.scrollTop
    let started: number | undefined
    frame.current = requestAnimationFrame(function step(now) {
      started ??= now
      const row = sentRow(view)
      const end = footer()
      // Until the list draws the message, its last rows are shown: the room under them alone draws none.
      const target = row
        ? contentTop(view, row)
        : end
          ? Math.max(0, contentTop(view, end) - view.clientHeight)
          : view.scrollHeight - view.clientHeight
      const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration)
      view.scrollTop = from + (target - from) * easeOut(progress)
      if (progress < 1 || (!row && now - started < 1000)) {
        frame.current = requestAnimationFrame(step)
        return
      }
      dispatch({ type: "scroll-ended", view: measure() })
    })
  }

  const scroll = (action: SentMessageScrollAction) => {
    const view = scroller.current
    if (!view) return
    switch (action.type) {
      case "animate-to-message":
        return animateToMessage(view)
      case "jump":
        view.scrollTop = action.top
        return
      case "end":
        // The next frame lets Virtuoso measure the shrunk room first, or it misses that the view reached the end.
        requestAnimationFrame(() => {
          view.scrollTop = view.scrollHeight
          // The browser sends its scroll event a frame later; a row added before then would not be followed.
          view.dispatchEvent(new Event("scroll"))
        })
    }
  }

  const dispatch = useCallback((event: SentMessageEvent) => {
    const step = nextSentMessageScroll(model.current, event)
    model.current = step.state
    setRoomLeft(step.state.roomLeft)
    // Set on the transcript for its stylesheet to read, as resize-handle does.
    if (step.room !== undefined)
      root.current?.style.setProperty("--iv-transcript-room", `${step.room}px`)
    if (step.scroll) scroll(step.scroll)
  }, [])

  const fitRoom = useCallback(() => {
    if (!needsMeasurement(model.current)) return
    const view = measure()
    if (view) dispatch({ type: "measured", view })
  }, [dispatch])

  useLayoutEffect(() => {
    const view = turnChanged(model.current, turnMessageId) ? measure() : undefined
    dispatch({ type: "rows-changed", loaded, turn: turnMessageId, rows, view })
  }, [loaded, turnMessageId, rows, dispatch])

  // On mount only: the view opens once at the restored place, then follows the transcript.
  useLayoutEffect(() => {
    dispatch({ type: "opened", place: restored, footerMinHeight: minHeight(footer()) })
  }, [])

  const sentMessagePlace = useCallback(() => placeOf(model.current), [])

  // A layout cleanup, so the message is measured while the list is still in the page.
  useLayoutEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      dispatch({ type: "scroll-cancelled", view: measure() })
    },
    [dispatch],
  )

  useEffect(() => {
    const view = scroller.current
    if (!view) return
    const observer = new ResizeObserver(fitRoom)
    observer.observe(view)
    return () => observer.disconnect()
  }, [loaded, rows.length === 0, fitRoom])

  const onUserScroll = useCallback(() => dispatch({ type: "user-scrolled" }), [dispatch])

  const scrollerRef = useCallback(
    (element: HTMLElement | Window | null) => {
      for (const type of USER_SCROLL_EVENTS)
        scroller.current?.removeEventListener(type, onUserScroll)
      scroller.current = element instanceof HTMLElement ? element : null
      for (const type of USER_SCROLL_EVENTS) scroller.current?.addEventListener(type, onUserScroll)
    },
    [onUserScroll],
  )

  // Any value but false lets Virtuoso scroll to the end, past the room left under the sent message.
  // A new function each render re-arms its scroll to the end for a row that grows once measured.
  const followOutput = mayFollowEnd(model.current, turnMessageId)
    ? (atBottom: boolean) => atBottom && ("auto" as const)
    : false

  return { root, scrollerRef, followOutput, fitRoom, sentMessagePlace }
}
