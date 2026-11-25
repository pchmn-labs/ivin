import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useMemo, useRef } from "react"
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
import { useFollowTranscript } from "../hooks/use-follow-transcript.ts"
import { TranscriptRow } from "./transcript-row.tsx"
import { BackgroundFold } from "./background-fold.tsx"
import { TurnWork } from "./turn-work.tsx"
import type { BackgroundTask } from "@ivin/contracts/session"
import "./transcript-view.css"

// Virtuoso counts down from here when rows are prepended, so it keeps the scroll anchor.
const FIRST_ITEM_INDEX = 1_000_000
// One 24px transcript line and the item's 8px padding above and below; keep in step with transcript-view.css.
const ROW_HEIGHT = 40
// `live`: the session's agent is working, so its last turn is under way.
export function TranscriptView({
  sessionId,
  live = false,
  sessionGone = false,
  background = [],
}: {
  sessionId: string
  live?: boolean
  sessionGone?: boolean
  // The tasks the agent rests on; the fold under the last turn lists them.
  background?: ReadonlyArray<BackgroundTask>
}) {
  const { loaded, failed, hasBefore, prepended, rows } = useAtomValue(transcriptOf(sessionId).view)
  const retry = useAtomRefresh(transcriptOf(sessionId).list.status)
  const loadItemsBefore = useAtomSet(loadItemsBeforeAtom)
  const shown = useMemo(() => shownRows(rows, live), [rows, live])
  const liveId = live ? shown.findLast((row) => row.type === "work")?.id : undefined
  const firstIndex = FIRST_ITEM_INDEX - prepended
  const restored = useRestoredPlace({ sessionId, loaded, firstIndex })
  const following = useRef(restored === undefined)
  const save = useSavePlace({ sessionId, firstIndex, following })
  const { scrollerRef, totalListHeightChanged } = useFollowTranscript({
    rows,
    live,
    following,
    list: save.list,
  })
  const { rangeChanged, startReached } = useLoadBefore({
    rows,
    firstIndex,
    hasBefore,
    load: () => loadItemsBefore(sessionId),
  })

  if (failed && !loaded) return <TranscriptFailure sessionGone={sessionGone} retry={retry} />
  if (!loaded) return <TranscriptEmpty>Loading the transcript…</TranscriptEmpty>
  if (shown.length === 0)
    return <TranscriptEmpty>No messages yet. Write to the agent below.</TranscriptEmpty>

  return (
    <div className="iv-transcript">
      <Virtuoso
        ref={save.listRef}
        scrollerRef={scrollerRef}
        data-testid="transcript"
        className="iv-transcript__list"
        data={shown}
        defaultItemHeight={ROW_HEIGHT}
        firstItemIndex={firstIndex}
        {...(restored
          ? { restoreStateFrom: restored.list }
          : { initialTopMostItemIndex: { index: "LAST", align: "end" } as const })}
        computeItemKey={(_, row) => row.id}
        totalListHeightChanged={totalListHeightChanged}
        components={{ Footer: TranscriptFooter }}
        context={{ sessionId, background }}
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
    <>
      {(live || row.itemIds.length > 0) && (
        <div className="iv-transcript__column">
          <div
            className="iv-transcript__item iv-transcript__item--turn"
            data-testid="transcript-work"
          >
            <TurnWork sessionId={sessionId} rowId={row.id} live={live} />
          </div>
        </div>
      )}
      {row.answerIds.map((id) => (
        <TranscriptRow key={id} sessionId={sessionId} id={id} />
      ))}
    </>
  )
}

function TranscriptFooter({
  context,
}: {
  context?: { sessionId: string; background: ReadonlyArray<BackgroundTask> }
}) {
  return (
    <>
      {context && <BackgroundFold sessionId={context.sessionId} tasks={context.background} />}
      <div className="iv-transcript__footer" />
    </>
  )
}

function TranscriptEmpty({ children }: { children: string }) {
  return (
    <div className="iv-transcript iv-transcript__empty">
      <Text tone="muted">{children}</Text>
    </div>
  )
}

function TranscriptFailure({ sessionGone, retry }: { sessionGone: boolean; retry: () => void }) {
  return (
    <div className="iv-transcript iv-transcript__failure">
      <FailureHeader
        message={
          sessionGone ? "This session no longer exists." : "The transcript could not be loaded."
        }
        {...(!sessionGone && { onRetry: retry })}
      />
      <FailureSkeleton />
    </div>
  )
}
