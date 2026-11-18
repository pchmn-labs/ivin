import { Block, Markdown, Text, defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"

function Message({ item }: SlotProps["transcript.message"]) {
  // Thinking stays in the transcript data but is not shown, as in the Claude CLI.
  if (item.type === "thinking") return null
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
      <Block tone="bubble">
        <Text as="p" preWrap>
          {item.text}
        </Text>
      </Block>
    )
  }
  return <Markdown text={item.text} />
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.message", Message, { name: "default" })
})
