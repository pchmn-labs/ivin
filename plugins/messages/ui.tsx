import { Block, Disclosure, Icon, Markdown, Stack, Text, defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"

function Message({ item }: SlotProps["transcript.message"]) {
  if (item.type === "thinking") {
    return (
      <Disclosure
        summary={
          <Stack as="span" direction="row" gap={2} align="center">
            <Icon name="brain" size={14} />
            <Text size="sm" tone="muted">
              Thinking
            </Text>
          </Stack>
        }
      >
        <Text as="p" size="sm" tone="muted" italic preWrap>
          {item.text}
        </Text>
      </Disclosure>
    )
  }
  if (item.type === "interruption") {
    return (
      <Text as="p" size="sm" tone="faint" italic>
        Interrupted
      </Text>
    )
  }
  if (item.type === "error") {
    return (
      <Block tone="danger" role="alert">
        <Text weight="medium" tone="danger">
          Error:
        </Text>{" "}
        <Text tone="danger">{item.message}</Text>
      </Block>
    )
  }
  if (item.role === "user") {
    return (
      <Block tone="subtle">
        <Stack gap={1}>
          <Text size="xs" tone="muted" weight="medium">
            You
          </Text>
          <Text as="p" preWrap>
            {item.text}
          </Text>
        </Stack>
      </Block>
    )
  }
  return (
    <Stack gap={1}>
      <Text size="xs" tone="muted" weight="medium">
        Claude
      </Text>
      <Markdown text={item.text} />
    </Stack>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.message", Message, { name: "default" })
})
