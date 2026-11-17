import { Markdown, defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"

function Message({ item }: SlotProps["transcript.message"]) {
  if (item.type === "thinking") {
    return (
      <details>
        <summary>Thinking</summary>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", fontStyle: "italic" }}>{item.text}</p>
      </details>
    )
  }
  if (item.type === "error") {
    return (
      <p role="alert" style={{ margin: 0, color: "crimson" }}>
        {item.message}
      </p>
    )
  }
  if (item.role === "user") {
    return (
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
        <strong>You</strong>
        <br />
        <span>{item.text}</span>
      </p>
    )
  }
  return (
    <div>
      <strong>Assistant</strong>
      <Markdown text={item.text} />
    </div>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.message", Message, { name: "default" })
})
