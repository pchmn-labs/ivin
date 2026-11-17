import { useAtomValue } from "@effect/atom-react"
import { transcriptOf } from "../atoms/get-items.ts"

export function TranscriptRow({ sessionId, id }: { sessionId: string; id: string }) {
  const item = useAtomValue(transcriptOf(sessionId).list.item(id))
  if (!item) return null

  return (
    <div data-testid="transcript-item" data-type={item.type} style={{ padding: "0.5rem 0" }}>
      {item.type === "message" && (
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          <strong>{item.role === "user" ? "You" : "Assistant"}</strong>
          <br />
          <span>{item.text}</span>
        </p>
      )}
      {item.type === "thinking" && (
        <p style={{ margin: 0, whiteSpace: "pre-wrap", fontStyle: "italic" }}>{item.text}</p>
      )}
      {item.type === "tool_call" && (
        <div>
          <p style={{ margin: 0 }}>
            <strong>{item.name}</strong> <span data-testid="tool-status">{item.status}</span>
          </p>
          {item.output !== null && (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{item.output}</pre>
          )}
        </div>
      )}
    </div>
  )
}
