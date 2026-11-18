import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Virtuoso } from "react-virtuoso"
import { transcriptOf } from "../atoms/get-items.ts"
import { loadItemsBeforeAtom } from "../atoms/load-items-before.ts"
import { Text } from "../../../core/ui/text/text.tsx"
import { TranscriptRow } from "./transcript-row.tsx"
import "./transcript-view.css"

// Virtuoso counts down from here when items are prepended, so it keeps the scroll anchor.
const FIRST_ITEM_INDEX = 1_000_000

export function TranscriptView({ sessionId }: { sessionId: string }) {
  const { loaded, hasBefore, prepended, ids } = useAtomValue(transcriptOf(sessionId).view)
  const loadItemsBefore = useAtomSet(loadItemsBeforeAtom)

  if (!loaded) return <TranscriptEmpty>Loading the transcript…</TranscriptEmpty>
  if (ids.length === 0) return <TranscriptEmpty>No messages yet</TranscriptEmpty>

  return (
    <div className="iv-transcript">
      <Virtuoso
        data-testid="transcript"
        className="iv-transcript__list"
        data={ids}
        firstItemIndex={FIRST_ITEM_INDEX - prepended}
        initialTopMostItemIndex={{ index: "LAST", align: "end" }}
        computeItemKey={(_, id) => id}
        followOutput={(atBottom) => (atBottom ? "auto" : false)}
        startReached={() => {
          if (hasBefore) loadItemsBefore(sessionId)
        }}
        itemContent={(_, id) => <TranscriptRow sessionId={sessionId} id={id} />}
      />
    </div>
  )
}

function TranscriptEmpty({ children }: { children: string }) {
  return (
    <div className="iv-transcript iv-transcript__empty">
      <Text tone="muted">{children}</Text>
    </div>
  )
}
