import { Block, Icon, Markdown, Stack, Text, defineUi } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"

const unignoredWorktrees =
  ".worktrees/ is not ignored by git, so the checkout lists it as untracked. Add .worktrees/ to .gitignore."

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
  if (item.type === "working_folder") {
    return (
      <Stack gap={1}>
        <Stack direction="row" gap={1} align="center">
          <Icon name="worktree" size={14} />
          <Text size="sm" tone="muted">
            Started in a new worktree on
          </Text>
          <Text size="sm" mono>
            {item.branch}
          </Text>
        </Stack>
        <Text size="xs" tone="faint" mono truncate title={item.path}>
          {item.path}
        </Text>
        {!item.worktreesIgnored && (
          <Text size="xs" tone="faint">
            {unignoredWorktrees}
          </Text>
        )}
      </Stack>
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
