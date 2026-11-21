import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { useCallback, useLayoutEffect, useMemo, useRef } from "react"
import { Virtuoso } from "react-virtuoso"
import { transcriptOf } from "../atoms/get-items.ts"
import { loadItemsBeforeAtom } from "../atoms/load-items-before.ts"
import { Text } from "../../../core/components/text/text.tsx"
import { lastTurnMessageId, type TranscriptRow as RowData } from "../rules/turns.ts"
import { TranscriptRow } from "./transcript-row.tsx"
import { TurnWork } from "./turn-work.tsx"
import "./transcript-view.css"

// Virtuoso counts down from here when rows are prepended, so it keeps the scroll anchor.
const FIRST_ITEM_INDEX = 1_000_000
// One 22px transcript line and the item's 8px padding above and below; keep in step with transcript-view.css.
const ROW_HEIGHT = 38
// --iv-duration-base and the transcript footer's minimum height; keep in step with the CSS.
const PIN_SCROLL_MS = 180
const FOOTER_GAP = 32
// --iv-ease-out, cubic-bezier(0.22, 1, 0.36, 1).
const easeOut = (t: number) => 1 - (1 - t) ** 5

// `live`: the session's agent is working, so its last turn is under way.
export function TranscriptView({ sessionId, live = false }: { sessionId: string; live?: boolean }) {
  const { loaded, hasBefore, prepended, rows } = useAtomValue(transcriptOf(sessionId).view)
  const loadItemsBefore = useAtomSet(loadItemsBeforeAtom)
  const shown = useMemo(
    () => (live ? rows : rows.filter((row) => row.type === "item" || row.itemIds.length > 0)),
    [rows, live],
  )
  const liveId = live ? shown.findLast((row) => row.type === "work")?.id : undefined
  const turnMessageId = useMemo(() => lastTurnMessageId(rows), [rows])

  const root = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLElement | null>(null)
  // Null until loaded, so the turns already there when the transcript opens are not scrolled to.
  const seenTurn = useRef<{ id: string | undefined } | null>(null)
  const pinnedId = useRef<string | undefined>(undefined)
  const pinScrolling = useRef(false)
  // While the sent message's turn leaves room under it, the transcript must not follow its end.
  const pinRoom = useRef(0)

  const setSpacer = useCallback((height: number) => {
    pinRoom.current = height
    root.current?.style.setProperty("--iv-transcript-spacer", `${Math.max(0, height)}px`)
  }, [])

  const pinnedRow = useCallback(() => {
    const id = pinnedId.current
    return id ? scroller.current?.querySelector(`[data-row-id="${CSS.escape(id)}"]`) : null
  }, [])

  const fitSpacer = useCallback(() => {
    const view = scroller.current
    const row = pinnedRow()
    const footer = view?.querySelector(".iv-transcript__footer")
    if (pinScrolling.current || !view || !row || !footer) return
    setSpacer(
      view.clientHeight - (footer.getBoundingClientRect().top - row.getBoundingClientRect().top),
    )
  }, [pinnedRow, setSpacer])

  useLayoutEffect(() => {
    if (!loaded) return
    if (seenTurn.current === null || seenTurn.current.id === turnMessageId) {
      seenTurn.current = { id: turnMessageId }
      return
    }
    seenTurn.current = { id: turnMessageId }
    const view = scroller.current
    if (!turnMessageId || !view) return
    pinnedId.current = turnMessageId
    pinScrolling.current = true
    setSpacer(view.clientHeight)

    const from = view.scrollTop
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    let started: number | undefined
    let frame = requestAnimationFrame(function step(now) {
      started ??= now
      const row = pinnedRow()
      // Until the virtual list draws the message, its end is the closest known target.
      const target = row
        ? view.scrollTop + row.getBoundingClientRect().top - view.getBoundingClientRect().top
        : view.scrollHeight - view.clientHeight
      const progress = reduced ? 1 : Math.min(1, (now - started) / PIN_SCROLL_MS)
      view.scrollTop = from + (target - from) * easeOut(progress)
      if (progress < 1 || (!row && now - started < PIN_SCROLL_MS * 5)) {
        frame = requestAnimationFrame(step)
        return
      }
      pinScrolling.current = false
      fitSpacer()
    })
    return () => {
      cancelAnimationFrame(frame)
      pinScrolling.current = false
    }
  }, [loaded, turnMessageId, setSpacer, pinnedRow, fitSpacer])

  if (!loaded) return <TranscriptEmpty>Loading the transcript…</TranscriptEmpty>
  if (shown.length === 0) return <TranscriptEmpty>No messages yet</TranscriptEmpty>

  return (
    <div className="iv-transcript" ref={root}>
      <Virtuoso
        scrollerRef={(element) => {
          scroller.current = element instanceof HTMLElement ? element : null
        }}
        data-testid="transcript"
        className="iv-transcript__list"
        data={shown}
        defaultItemHeight={ROW_HEIGHT}
        firstItemIndex={FIRST_ITEM_INDEX - prepended}
        initialTopMostItemIndex={{ index: "LAST", align: "end" }}
        computeItemKey={(_, row) => row.id}
        followOutput={(atBottom) =>
          atBottom && !pinScrolling.current && pinRoom.current <= FOOTER_GAP ? "auto" : false
        }
        totalListHeightChanged={fitSpacer}
        components={{ Footer: TranscriptFooter }}
        startReached={() => {
          if (hasBefore) loadItemsBefore(sessionId)
        }}
        itemContent={(_, row) => (
          <RowContent sessionId={sessionId} row={row} live={row.id === liveId} />
        )}
      />
    </div>
  )
}

function RowContent({ sessionId, row, live }: { sessionId: string; row: RowData; live: boolean }) {
  if (row.type === "item") return <TranscriptRow sessionId={sessionId} id={row.id} />
  return (
    <div className="iv-transcript__column">
      <div className="iv-transcript__item" data-testid="transcript-work">
        <TurnWork sessionId={sessionId} rowId={row.id} live={live} />
      </div>
    </div>
  )
}

function TranscriptFooter() {
  return <div className="iv-transcript__footer" />
}

function TranscriptEmpty({ children }: { children: string }) {
  return (
    <div className="iv-transcript iv-transcript__empty">
      <Text tone="muted">{children}</Text>
    </div>
  )
}
