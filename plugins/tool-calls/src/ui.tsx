import { CodeBlock, Disclosure, FilePath, Icon, Stack, Text, defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps, ToolCallItem } from "@ivin/plugin-api/ui"
import { filePathArgument, mainArgument, prettyInput } from "./rules/tool-output.ts"
import { toolIcon } from "./rules/tool-icon.ts"

function ToolHeader({
  item,
  main,
  sessionId,
}: {
  item: ToolCallItem
  main: string | null
  sessionId: string
}) {
  const path = filePathArgument(item.name, item.input)
  return (
    <Stack as="span" direction="row" gap={2} align="center" grow>
      <Icon name={toolIcon(item.kind)} size={14} />
      <Text weight="medium">{item.name}</Text>
      <Stack as="span" grow>
        <Text size="sm" tone="muted" mono truncate>
          {path === null ? (main ?? "") : <FilePath sessionId={sessionId} path={path} />}
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

function ToolCall({ item, sessionId }: SlotProps["transcript.toolCall"]) {
  const main = mainArgument(item.name, item.input)
  const showInput = main === null && item.input !== undefined
  const header = <ToolHeader item={item} main={main} sessionId={sessionId} />
  // A successful skill call outputs only "Launching skill: <name>", already on the row.
  const quietSkill = item.kind === "skill" && item.status !== "error"
  if ((item.output === null || quietSkill) && !showInput) return header
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
