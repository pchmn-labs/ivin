import { defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"

function ToolCall({ item }: SlotProps["transcript.toolCall"]) {
  return (
    <div>
      <p style={{ margin: 0 }}>
        <strong>{item.name}</strong> <span data-testid="tool-status">{item.status}</span>
      </p>
      {item.output !== null && (
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{item.output}</pre>
      )}
    </div>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.toolCall", ToolCall, { name: "default" })
})
