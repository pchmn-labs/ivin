import { useAtomValue } from "@effect/atom-react"
import { Slot } from "../../../app/slot-renderer.tsx"
import { transcriptOf } from "../atoms/get-items.ts"
import "./transcript-view.css"

export function TranscriptRow({ sessionId, id }: { sessionId: string; id: string }) {
  const item = useAtomValue(transcriptOf(sessionId).list.item(id))
  if (!item || item.type === "usage") return null

  return (
    <div className="iv-transcript__column">
      <div className="iv-transcript__item" data-testid="transcript-item" data-type={item.type}>
        {item.type === "tool_call" ? (
          <Slot slot="transcript.toolCall" tool={item.name} props={{ item, sessionId }} />
        ) : item.type === "approval" ? (
          <Slot slot="transcript.approval" props={{ item, sessionId }} />
        ) : (
          <Slot slot="transcript.message" props={{ item, sessionId }} />
        )}
      </div>
    </div>
  )
}
