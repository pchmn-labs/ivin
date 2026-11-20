import { CodeBlock, Disclosure, Icon, Stack, Text, defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps, ToolCallItem } from "@ivin/plugin-api/ui"
import { mainArgument, prettyInput } from "./rules/tool-output.ts"
import { toolIcon } from "./rules/tool-icon.ts"

function ToolHeader({ item, main }: { item: ToolCallItem; main: string | null }) {
  return (
    <Stack as="span" direction="row" gap={2} align="center" grow>
      <Icon name={toolIcon(item.kind)} size={14} />
      <Text weight="medium">{item.name}</Text>
      <Stack as="span" grow>
        <Text size="sm" tone="muted" mono truncate>
          {main ?? ""}
        </Text>
      </Stack>
      {item.status === "running" && (
        <Text size="sm" tone="muted" data-testid="tool-status">
          <Icon name="loader" size={12} label="running" />
        </Text>
      )}
      {item.status === "error" && (
        <Text size="sm" tone="danger" data-testid="tool-status">
          failed
        </Text>
      )}
    </Stack>
  )
}

function ToolCall({ item }: SlotProps["transcript.toolCall"]) {
  const main = mainArgument(item.name, item.input)
  const showInput = main === null && item.input !== undefined
  const header = <ToolHeader item={item} main={main} />
  if (item.output === null && !showInput) return header
  return (
    <Disclosure variant="row" data-testid="tool-output" summary={header}>
      <Stack gap={2}>
        {showInput && <CodeBlock text={prettyInput(item.input)} />}
        {item.output !== null && <CodeBlock text={item.output} />}
      </Stack>
    </Disclosure>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.toolCall", ToolCall, { name: "default" })
})
