import { useAtomValue } from "@effect/atom-react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { Slot } from "../../../app/slot-renderer.tsx"
import { transcriptOf } from "../atoms/get-items.ts"
import "./transcript-view.css"

export function TranscriptRow({ sessionId, id }: { sessionId: string; id: string }) {
  const item = useAtomValue(transcriptOf(sessionId).list.item(id))
  if (!item || item.type === "usage") return null

  return (
    <div className="iv-transcript__column">
      <div className="iv-transcript__item" data-testid="transcript-item" data-type={item.type}>
        <ItemSlot item={item} sessionId={sessionId} />
      </div>
    </div>
  )
}

export function ItemSlot({ item, sessionId }: { item: TranscriptItem; sessionId: string }) {
  if (item.type === "tool_call") {
    return <Slot slot="transcript.toolCall" tool={item.name} props={{ item, sessionId }} />
  }
  if (item.type === "approval")
    return <Slot slot="transcript.approval" props={{ item, sessionId }} />
  if (item.type === "usage") return null
  return <Slot slot="transcript.message" props={{ item, sessionId }} />
}
