import { CodeBlock, Disclosure, Icon, Stack, Text, defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"
import { foldText, formatInput } from "./rules/tool-output.ts"

const STATUS_LABELS = { running: "running", done: "succeeded", error: "failed" } as const

function FoldedText({ text, label, testId }: { text: string; label?: string; testId?: string }) {
  const { folded, preview } = foldText(text)
  const testIdProp = testId === undefined ? {} : { "data-testid": testId }
  if (!folded) return <CodeBlock text={text} {...testIdProp} />
  return (
    <Disclosure
      {...testIdProp}
      summary={
        label ?? (
          <Text size="sm" tone="muted" mono preWrap>
            {preview}
          </Text>
        )
      }
    >
      <CodeBlock text={text} />
    </Disclosure>
  )
}

function ToolCall({ item }: SlotProps["transcript.toolCall"]) {
  const failed = item.status === "error"
  return (
    <Stack gap={2}>
      <Stack direction="row" gap={2} align="center">
        <Icon name="wrench" size={14} />
        <Text weight="medium">{item.name}</Text>
        <Stack as="span" direction="row" gap={1} align="center">
          {item.status === "running" && <Icon name="loader" size={12} />}
          <Text size="sm" tone={failed ? "danger" : "muted"} data-testid="tool-status">
            {STATUS_LABELS[item.status]}
          </Text>
        </Stack>
      </Stack>
      <FoldedText text={formatInput(item.input)} label="Input" />
      {item.output !== null && <FoldedText text={item.output} testId="tool-output" />}
    </Stack>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.toolCall", ToolCall, { name: "default" })
})
