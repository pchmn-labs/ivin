import { Block, Icon, Markdown, Stack, Text, defineUi } from "@ivin/plugin-api/ui"
import type { RunOptionItem, SlotProps, WorkingFolderItem } from "@ivin/plugin-api/ui"

const unignoredWorktrees =
  ".worktrees/ is not ignored by git, so the checkout lists it as untracked. Add .worktrees/ to .gitignore."

const workingFolderLabel = (item: WorkingFolderItem) => {
  if (item.cause === "creation") return "Started in a new worktree on"
  if (item.cause === "choice") return "Started in the worktree on"
  if (item.cause === "branch_picker") return "Switched to"
  if (item.cause === "pick" && !item.inWorktree) return "Moved to the checkout on"
  return item.inWorktree ? "Moved to the worktree on" : "Back in the checkout on"
}

const RUN_OPTION_LABELS: Record<RunOptionItem["option"], string> = {
  model: "Model",
  effort: "Effort",
  permissionMode: "Permission mode",
}

function Message({ item }: SlotProps["transcript.message"]) {
  // Thinking stays in the transcript data but is not shown, as in the agent CLIs.
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
          <Icon name={item.inWorktree ? "worktree" : "folder"} size={14} />
          <Text size="sm" tone="muted">
            {workingFolderLabel(item)}
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
  if (item.type === "run_option") {
    return (
      <Text as="p" size="sm" tone="muted">
        {RUN_OPTION_LABELS[item.option]} changed from{" "}
        <Text size="sm" mono>
          {item.from}
        </Text>{" "}
        to{" "}
        <Text size="sm" mono>
          {item.to}
        </Text>
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
