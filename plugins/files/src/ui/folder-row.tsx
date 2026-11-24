import { Icon, Stack, Text, type Session } from "@ivin/plugin-api/ui"
import { useFolderLabel } from "../hooks/use-folder-label.ts"

export function FolderRow({ session }: { session: Session }) {
  return (
    <Stack direction="row" gap={1} align="center">
      <Icon name={session.inWorktree ? "worktree" : "folder"} size={12} />
      <Text size="xs" tone="faint" mono truncate title={session.workingFolder}>
        {useFolderLabel(session)}
      </Text>
    </Stack>
  )
}
