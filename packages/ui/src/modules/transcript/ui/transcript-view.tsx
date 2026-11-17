import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Virtuoso } from "react-virtuoso"
import { transcriptOf } from "../atoms/get-items.ts"
import { loadItemsBeforeAtom } from "../atoms/load-items-before.ts"
import { TranscriptRow } from "./transcript-row.tsx"

// Virtuoso counts down from here when items are prepended, so it keeps the scroll anchor.
const FIRST_ITEM_INDEX = 1_000_000

export function TranscriptView({ sessionId }: { sessionId: string }) {
  const { loaded, hasBefore, prepended, ids } = useAtomValue(transcriptOf(sessionId).view)
  const loadItemsBefore = useAtomSet(loadItemsBeforeAtom)

  if (!loaded) return <p>Loading the transcript…</p>
  if (ids.length === 0) return <p>No messages yet</p>

  return (
    <Virtuoso
      data-testid="transcript"
      style={{ height: "100%" }}
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
  )
}
