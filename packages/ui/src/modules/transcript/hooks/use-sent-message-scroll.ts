import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { lastTurnMessageId, type TranscriptRow } from "../rules/turns.ts"

// --iv-ease-out, cubic-bezier(0.22, 1, 0.36, 1), approximated as an ease-out quint.
const easeOut = (t: number) => 1 - (1 - t) ** 5

const cssMs = (element: Element, token: string) =>
  Number.parseFloat(getComputedStyle(element).getPropertyValue(token)) || 0

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
  const scrolling = useRef(false)
  const room = useRef(0)
  // Null until loaded, so the turns already there when the transcript opens are not scrolled to.
  const seen = useRef<{ turn: string | undefined; lastRow: string | undefined } | null>(null)

  const turnMessageId = lastTurnMessageId(rows)

  const setRoom = useCallback((height: number) => {
    room.current = Math.max(0, height)
    // Set on the transcript for its stylesheet to read, as resize-handle does.
    root.current?.style.setProperty("--iv-transcript-room", `${room.current}px`)
  }, [])

  const footer = () => root.current?.querySelector<HTMLElement>(".iv-transcript__footer")

  const sentRow = () => {
    const id = sentId.current
    return id ? scroller.current?.querySelector(`[data-row-id="${CSS.escape(id)}"]`) : null
  }

  const fitRoom = useCallback(() => {
    const view = scroller.current
    const row = sentRow()
    const end = footer()
    if (scrolling.current || !view || !row || !end) return
    setRoom(view.clientHeight - (end.getBoundingClientRect().top - row.getBoundingClientRect().top))
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
    scrolling.current = true
    setRoom(view.clientHeight)
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : cssMs(view, "--iv-duration-base")
    const from = view.scrollTop
    let started: number | undefined
    let frame = requestAnimationFrame(function step(now) {
      started ??= now
      const row = sentRow()
      // Until the virtual list draws the message, the list's end is the closest known target.
      const target = row
        ? view.scrollTop + row.getBoundingClientRect().top - view.getBoundingClientRect().top
        : view.scrollHeight - view.clientHeight
      const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration)
      view.scrollTop = from + (target - from) * easeOut(progress)
      if (progress < 1 || (!row && now - started < 1000)) {
        frame = requestAnimationFrame(step)
        return
      }
      scrolling.current = false
      if (row) fitRoom()
      else setRoom(0)
    })
    return () => {
      cancelAnimationFrame(frame)
      scrolling.current = false
    }
  }, [loaded, turnMessageId, rows, setRoom, fitRoom])

  useEffect(() => {
    const view = scroller.current
    if (!view) return
    const observer = new ResizeObserver(fitRoom)
    observer.observe(view)
    return () => observer.disconnect()
  }, [loaded, rows.length === 0, fitRoom])

  const scrollerRef = useCallback((element: HTMLElement | Window | null) => {
    scroller.current = element instanceof HTMLElement ? element : null
  }, [])

  // While the room under the sent message's turn is not used up, following the end would skip it.
  const followOutput = (atBottom: boolean) => {
    const end = footer()
    const floor = end ? Number.parseFloat(getComputedStyle(end).minHeight) : 0
    return atBottom && !scrolling.current && room.current <= floor ? ("auto" as const) : false
  }

  return { root, scrollerRef, followOutput, fitRoom }
}
