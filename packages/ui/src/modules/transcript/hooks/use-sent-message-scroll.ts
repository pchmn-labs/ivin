import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { lastTurnMessageId, type TranscriptRow } from "../rules/turns.ts"

// --iv-ease-out, cubic-bezier(0.22, 1, 0.36, 1), approximated as an ease-out quint.
const easeOut = (t: number) => 1 - (1 - t) ** 5

const cssMs = (element: Element, token: string) =>
  Number.parseFloat(getComputedStyle(element).getPropertyValue(token)) || 0

const USER_SCROLL_EVENTS = ["wheel", "touchmove", "keydown", "pointerdown"] as const

// Scrolls a message the user sends to the top of the transcript, with room under it for the answer.
export function useSentMessageScroll({
  loaded,
  rows,
}: {
  loaded: boolean
  rows: ReadonlyArray<TranscriptRow>
}) {
  const root = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLElement | null>(null)
  const sentId = useRef<string | undefined>(undefined)
  const sentTop = useRef<number | undefined>(undefined)
  const scrolling = useRef(false)
  const room = useRef(0)
  const frame = useRef(0)
  const userScrolled = useRef(false)
  const [roomLeft, setRoomLeft] = useState(false)
  // Null until loaded, so the turns already there when the transcript opens are not scrolled to.
  const seen = useRef<{ turn: string | undefined; lastRow: string | undefined } | null>(null)

  const turnMessageId = lastTurnMessageId(rows)

  const footer = () => root.current?.querySelector<HTMLElement>(".iv-transcript__footer")

  const hasRoomLeft = () => {
    const end = footer()
    return room.current > (end ? Number.parseFloat(getComputedStyle(end).minHeight) : 0)
  }

  const setRoom = useCallback((height: number) => {
    room.current = Math.max(0, height)
    setRoomLeft(hasRoomLeft())
    // Set on the transcript for its stylesheet to read, as resize-handle does.
    root.current?.style.setProperty("--iv-transcript-room", `${room.current}px`)
  }, [])

  const sentRow = () => {
    const id = sentId.current
    return id ? scroller.current?.querySelector(`[data-row-id="${CSS.escape(id)}"]`) : null
  }

  const contentTop = (view: HTMLElement, element: Element) =>
    view.scrollTop + element.getBoundingClientRect().top - view.getBoundingClientRect().top

  // Virtuoso unmounts the message once it scrolls out of view, so its last known place stands in.
  const sentRowTop = (view: HTMLElement) => {
    const row = sentRow()
    if (row) sentTop.current = contentTop(view, row)
    return sentTop.current
  }

  const fitRoom = useCallback(() => {
    const view = scroller.current
    const end = footer()
    if (scrolling.current || !view || !end) return
    const top = sentRowTop(view)
    if (top === undefined) return
    const held = hasRoomLeft()
    setRoom(view.clientHeight - (contentTop(view, end) - top))
    if (userScrolled.current) return
    // The turn's rows can shrink before the room grows back, and the browser then scrolls up to fit.
    if (hasRoomLeft()) view.scrollTop = top
    // Virtuoso follows only from the end, and a row taller than the room leaves the view short of it.
    // The next frame lets it measure the shrunk room first, or it misses that the view reached the end.
    else if (held)
      requestAnimationFrame(() => {
        view.scrollTop = view.scrollHeight
        // The browser sends its scroll event a frame later; a row added before then would not be followed.
        view.dispatchEvent(new Event("scroll"))
      })
  }, [setRoom])

  useLayoutEffect(() => {
    if (!loaded) return
    const previous = seen.current
    seen.current = { turn: turnMessageId, lastRow: rows.at(-1)?.id }
    if (previous === null || previous.turn === turnMessageId || !turnMessageId) return
    // A message revealed by loading older items sits before the previous last row.
    const index = rows.findIndex((row) => row.id === turnMessageId)
    const lastIndex = rows.findIndex((row) => row.id === previous.lastRow)
    const view = scroller.current
    if (index <= lastIndex || !view) return

    sentId.current = turnMessageId
    sentTop.current = undefined
    userScrolled.current = false
    cancelAnimationFrame(frame.current)
    scrolling.current = true
    setRoom(view.clientHeight)
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : cssMs(view, "--iv-duration-base")
    const from = view.scrollTop
    let started: number | undefined
    frame.current = requestAnimationFrame(function step(now) {
      started ??= now
      const row = sentRow()
      // Until the virtual list draws the message, the list's end is the closest known target.
      const target = row
        ? view.scrollTop + row.getBoundingClientRect().top - view.getBoundingClientRect().top
        : view.scrollHeight - view.clientHeight
      const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration)
      view.scrollTop = from + (target - from) * easeOut(progress)
      if (progress < 1 || (!row && now - started < 1000)) {
        frame.current = requestAnimationFrame(step)
        return
      }
      scrolling.current = false
      if (row) fitRoom()
      else setRoom(0)
    })
  }, [loaded, turnMessageId, rows, setRoom, fitRoom])

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      scrolling.current = false
    },
    [],
  )

  useEffect(() => {
    const view = scroller.current
    if (!view) return
    const observer = new ResizeObserver(fitRoom)
    observer.observe(view)
    return () => observer.disconnect()
  }, [loaded, rows.length === 0, fitRoom])

  const onUserScroll = useCallback(() => {
    userScrolled.current = true
  }, [])

  const scrollerRef = useCallback(
    (element: HTMLElement | Window | null) => {
      for (const type of USER_SCROLL_EVENTS)
        scroller.current?.removeEventListener(type, onUserScroll)
      scroller.current = element instanceof HTMLElement ? element : null
      for (const type of USER_SCROLL_EVENTS) scroller.current?.addEventListener(type, onUserScroll)
    },
    [onUserScroll],
  )

  // Virtuoso reads followOutput for the render that adds the sent message, before the effect above leaves room.
  const sending =
    seen.current !== null && turnMessageId !== undefined && turnMessageId !== seen.current.turn
  // Any value but false lets Virtuoso scroll to the end, past the room left under the sent message.
  // A new function each render re-arms its scroll to the end for a row that grows once measured.
  const followOutput =
    roomLeft || sending ? false : (atBottom: boolean) => atBottom && ("auto" as const)

  return { root, scrollerRef, followOutput, fitRoom }
}
