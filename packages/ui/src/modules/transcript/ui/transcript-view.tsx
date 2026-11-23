import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useCallback, useMemo } from "react"
import { Virtuoso } from "react-virtuoso"
import { transcriptOf } from "../atoms/get-items.ts"
import { loadItemsBeforeAtom } from "../atoms/load-items-before.ts"
import {
  FailureHeader,
  FailureSkeleton,
} from "../../../core/components/failure-state/failure-state.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { shownRows, type TranscriptRow as RowData } from "../rules/turns.ts"
import { useLoadBefore } from "../hooks/use-load-before.ts"
import { useRestoredPlace, useSavePlace } from "../hooks/use-transcript-place.ts"
import { useSentMessageScroll } from "../hooks/use-sent-message-scroll.ts"
import { TranscriptRow } from "./transcript-row.tsx"
import { TurnWork } from "./turn-work.tsx"
import "./transcript-view.css"

// Virtuoso counts down from here when rows are prepended, so it keeps the scroll anchor.
const FIRST_ITEM_INDEX = 1_000_000
// One 24px transcript line and the item's 8px padding above and below; keep in step with transcript-view.css.
const ROW_HEIGHT = 40
// `live`: the session's agent is working, so its last turn is under way.
// `missing`: the session is no longer in its project.
export function TranscriptView({
  sessionId,
  live = false,
  missing = false,
}: {
  sessionId: string
  live?: boolean
  missing?: boolean
}) {
  const { loaded, failed, hasBefore, prepended, rows } = useAtomValue(transcriptOf(sessionId).view)
  const retry = useAtomRefresh(transcriptOf(sessionId).list.status)
  const loadItemsBefore = useAtomSet(loadItemsBeforeAtom)
  const shown = useMemo(() => shownRows(rows, live), [rows, live])
  const liveId = live ? shown.findLast((row) => row.type === "work")?.id : undefined
  const firstIndex = FIRST_ITEM_INDEX - prepended
  const restored = useRestoredPlace({ sessionId, loaded, firstIndex })
  const { root, scrollerRef, followOutput, fitRoom, sentMessagePlace } = useSentMessageScroll({
    loaded,
    rows,
    restored: restored?.sent,
  })
  const save = useSavePlace({ sessionId, firstIndex, sentMessagePlace })
  const bothScrollerRefs = useCallback(
    (element: HTMLElement | Window | null) => {
      scrollerRef(element)
      save.scrollerRef(element instanceof HTMLElement ? element : null)
    },
    [scrollerRef, save.scrollerRef],
  )
  const { rangeChanged, startReached } = useLoadBefore({
    rows,
    firstIndex,
    hasBefore,
    load: () => loadItemsBefore(sessionId),
  })

  if (failed && !loaded) return <TranscriptFailure missing={missing} retry={retry} />
  if (!loaded) return <TranscriptEmpty>Loading the transcript…</TranscriptEmpty>
  if (shown.length === 0) return <TranscriptEmpty>No messages yet</TranscriptEmpty>

  return (
    <div className="iv-transcript" ref={root}>
      <Virtuoso
        ref={save.listRef}
        scrollerRef={bothScrollerRefs}
        data-testid="transcript"
        className="iv-transcript__list"
        data={shown}
        defaultItemHeight={ROW_HEIGHT}
        firstItemIndex={firstIndex}
        {...(restored
          ? { restoreStateFrom: restored.list }
          : { initialTopMostItemIndex: { index: "LAST", align: "end" } as const })}
        computeItemKey={(_, row) => row.id}
        followOutput={followOutput}
        totalListHeightChanged={fitRoom}
        components={{ Footer: TranscriptFooter }}
        rangeChanged={rangeChanged}
        startReached={startReached}
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

function TranscriptFailure({ missing, retry }: { missing: boolean; retry: () => void }) {
  return (
    <div className="iv-transcript iv-transcript__failure">
      <FailureHeader
        message={missing ? "This session no longer exists." : "The transcript could not be loaded."}
        {...(!missing && { onRetry: retry })}
      />
      <FailureSkeleton />
    </div>
  )
}
