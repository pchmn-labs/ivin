import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { useCallback, useLayoutEffect, useMemo, useRef } from "react"
import { Virtualizer, type VirtualizerHandle } from "virtua"
import { transcriptOf } from "../atoms/get-items.ts"
import { loadItemsBeforeAtom } from "../atoms/load-items-before.ts"
import { Text } from "../../../core/components/text/text.tsx"
import type { TranscriptRow as RowData } from "../rules/turns.ts"
import { useSentMessageScroll } from "../hooks/use-sent-message-scroll.ts"
import { TranscriptRow } from "./transcript-row.tsx"
import { TurnWork } from "./turn-work.tsx"
import "./transcript-view.css"

// Older items load once the view is this close to the top of what is loaded.
const LOAD_BEFORE_WITHIN = 400
// `live`: the session's agent is working, so its last turn is under way.
export function TranscriptView({ sessionId, live = false }: { sessionId: string; live?: boolean }) {
  const { loaded, hasBefore, prepended, rows } = useAtomValue(transcriptOf(sessionId).view)
  const loadItemsBefore = useAtomSet(loadItemsBeforeAtom)
  const shown = useMemo(
    () => (live ? rows : rows.filter((row) => row.type === "item" || row.itemIds.length > 0)),
    [rows, live],
  )
  const liveId = live ? shown.findLast((row) => row.type === "work")?.id : undefined
  const { root, scrollerRef, followOutput, fitRoom } = useSentMessageScroll({ loaded, rows })
  const list = useRef<VirtualizerHandle>(null)
  const scroller = useRef<HTMLDivElement | null>(null)
  const atBottom = useRef(true)
  const shownPrepended = useRef(prepended)
  const shift = prepended !== shownPrepended.current
  shownPrepended.current = prepended

  const setScroller = useCallback(
    (element: HTMLDivElement | null) => {
      scroller.current = element
      scrollerRef(element)
    },
    [scrollerRef],
  )
  // A resize the user caused by folding or unfolding, which must not move the view.
  const clicked = useRef({ at: 0, scrollTop: 0 })
  const follow = () => {
    const view = scroller.current
    if (view && followOutput(atBottom.current)) view.scrollTop = view.scrollHeight
  }
  const loadBeforeNearTop = () => {
    const handle = list.current
    if (handle && hasBefore && handle.scrollOffset < LOAD_BEFORE_WITHIN) loadItemsBefore(sessionId)
  }
  useLayoutEffect(follow, [shown])

  if (!loaded) return <TranscriptEmpty>Loading the transcript…</TranscriptEmpty>
  if (shown.length === 0) return <TranscriptEmpty>No messages yet</TranscriptEmpty>

  return (
    <div className="iv-transcript" ref={root}>
      <div
        ref={setScroller}
        data-testid="transcript"
        className="iv-transcript__list"
        onClickCapture={(event) =>
          (clicked.current = { at: performance.now(), scrollTop: event.currentTarget.scrollTop })
        }
      >
        <Virtualizer
          ref={list}
          data={shown}
          shift={shift}
          onScroll={() => {
            const view = scroller.current
            if (!view) return
            // The DOM's sizes, as the footer after the list is not in virtua's.
            atBottom.current = view.scrollHeight - view.scrollTop - view.clientHeight < 2
            loadBeforeNearTop()
          }}
          onResize={() => {
            const view = scroller.current
            // virtua moves the view when a row starting above it resizes; a fold must not move it.
            if (performance.now() - clicked.current.at < 300 && view)
              view.scrollTop = clicked.current.scrollTop
            else follow()
            fitRoom()
            loadBeforeNearTop()
          }}
        >
          {(row) => (
            <RowContent key={row.id} sessionId={sessionId} row={row} live={row.id === liveId} />
          )}
        </Virtualizer>
        <TranscriptFooter />
      </div>
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
