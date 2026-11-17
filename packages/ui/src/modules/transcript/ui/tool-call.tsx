import type { ReactNode } from "react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { foldText, formatInput } from "../rules/tool-output.ts"

type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>

const STATUS_LABELS = { running: "running", done: "succeeded", error: "failed" } as const

const preStyle = { margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" } as const

function FoldedText({ text, label, testId }: { text: string; label?: string; testId?: string }) {
  const { folded, preview } = foldText(text)
  const pre = <pre style={preStyle}>{text}</pre>
  if (!folded) return pre
  const summary: ReactNode = label ?? <span style={{ whiteSpace: "pre-wrap" }}>{preview}</span>
  return (
    <details data-testid={testId}>
      <summary>{summary}</summary>
      {pre}
    </details>
  )
}

export function ToolCall({ item }: { item: ToolCallItem }) {
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
