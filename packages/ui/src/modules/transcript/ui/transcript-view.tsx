import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { useMemo } from "react"
import { Virtuoso } from "react-virtuoso"
import { transcriptOf } from "../atoms/get-items.ts"
import { loadItemsBeforeAtom } from "../atoms/load-items-before.ts"
import { Text } from "../../../core/components/text/text.tsx"
import type { TranscriptRow as RowData } from "../rules/turns.ts"
import { useSentMessageScroll } from "../hooks/use-sent-message-scroll.ts"
import { TranscriptRow } from "./transcript-row.tsx"
import { TurnWork } from "./turn-work.tsx"
import "./transcript-view.css"

// Virtuoso counts down from here when rows are prepended, so it keeps the scroll anchor.
const FIRST_ITEM_INDEX = 1_000_000
// One 22px transcript line and the item's 8px padding above and below; keep in step with transcript-view.css.
const ROW_HEIGHT = 38
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

  if (!loaded) return <TranscriptEmpty>Loading the transcript…</TranscriptEmpty>
  if (shown.length === 0) return <TranscriptEmpty>No messages yet</TranscriptEmpty>

  return (
    <div className="iv-transcript" ref={root}>
      <Virtuoso
        scrollerRef={scrollerRef}
        data-testid="transcript"
        className="iv-transcript__list"
        data={shown}
        defaultItemHeight={ROW_HEIGHT}
        firstItemIndex={FIRST_ITEM_INDEX - prepended}
        initialTopMostItemIndex={{ index: "LAST", align: "end" }}
        computeItemKey={(_, row) => row.id}
        followOutput={followOutput}
        totalListHeightChanged={fitRoom}
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
