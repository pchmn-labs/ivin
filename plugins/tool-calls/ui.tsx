import { CodeBlock, Disclosure, Icon, Stack, Text, defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"
import { foldText, mainArgument, prettyInput } from "./rules/tool-output.ts"

const STATUS_LABELS = { running: "running", done: "succeeded", error: "failed" } as const

function ToolCall({ item }: SlotProps["transcript.toolCall"]) {
  const failed = item.status === "error"
  const main = mainArgument(item.name, item.input)
  const output = item.output === null ? null : foldText(item.output)
  const showInput = main === null && item.input !== undefined
  const summary = output?.folded ? output.preview : output === null ? "Input" : "Output"
  return (
    <Stack gap={2}>
      <Stack direction="row" gap={2} align="center">
        <Icon name="wrench" size={14} />
        <Text weight="medium">{item.name}</Text>
        <Stack as="span" grow>
          <Text size="sm" tone="muted" mono truncate>
            {main ?? ""}
          </Text>
        </Stack>
        <Stack as="span" direction="row" gap={1} align="center">
          {item.status === "running" && <Icon name="loader" size={12} />}
          <Text size="sm" tone={failed ? "danger" : "muted"} data-testid="tool-status">
            {STATUS_LABELS[item.status]}
          </Text>
        </Stack>
      </Stack>
      {(output !== null || showInput) && (
        <Disclosure
          {...(output === null ? {} : { "data-testid": "tool-output" })}
          summary={
            <Text size="sm" tone="muted" mono={output?.folded === true} preWrap>
              {summary}
            </Text>
          }
        >
          <Stack gap={2}>
            {showInput && <CodeBlock text={prettyInput(item.input)} />}
            {item.output !== null && <CodeBlock text={item.output} />}
          </Stack>
        </Disclosure>
      )}
    </Stack>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.toolCall", ToolCall, { name: "default" })
})
