import { defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"

function Message({ item }: SlotProps["transcript.message"]) {
  if (item.type === "thinking") {
    return <p style={{ margin: 0, whiteSpace: "pre-wrap", fontStyle: "italic" }}>{item.text}</p>
  }
  return (
    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
      <strong>{item.role === "user" ? "You" : "Assistant"}</strong>
      <br />
      <span>{item.text}</span>
    </p>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.message", Message, { name: "default" })
})
