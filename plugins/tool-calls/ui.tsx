import { defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"
import { foldText, formatInput } from "./rules/tool-output.ts"

const STATUS_LABELS = { running: "running", done: "succeeded", error: "failed" } as const

const preStyle = { margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" } as const

function FoldedText({ text, label, testId }: { text: string; label?: string; testId?: string }) {
  const { folded, preview } = foldText(text)
  const pre = <pre style={preStyle}>{text}</pre>
  if (!folded) return pre
  return (
    <details data-testid={testId}>
      <summary>{label ?? <span style={{ whiteSpace: "pre-wrap" }}>{preview}</span>}</summary>
      {pre}
    </details>
  )
}

function ToolCall({ item }: SlotProps["transcript.toolCall"]) {
  return (
    <div>
      <p style={{ margin: 0 }}>
        <strong>{item.name}</strong>{" "}
        <span data-testid="tool-status">{STATUS_LABELS[item.status]}</span>
      </p>
      <FoldedText text={formatInput(item.input)} label="Input" />
      {item.output !== null && <FoldedText text={item.output} testId="tool-output" />}
    </div>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.toolCall", ToolCall, { name: "default" })
})
