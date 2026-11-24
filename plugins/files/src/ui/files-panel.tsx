import { EmptyMessage, Stack, useSelectedSessionId, useSession } from "@ivin/plugin-api/ui"
import { treeKey, type PluginState } from "../rules/plugin-state.ts"
import { FOLDER_DELETED } from "../rules/messages.ts"
import { FolderRow } from "./folder-row.tsx"
import { FolderTreeView } from "./folder-tree-view.tsx"

export function FilesPanel({ state }: { state: PluginState }) {
  const sessionId = useSelectedSessionId()
  const session = useSession(sessionId ?? "")
  if (sessionId === null) {
    return (
      <EmptyMessage>
        No session on screen. Open one to see the files of its working folder.
      </EmptyMessage>
    )
  }
  if (session === undefined) return null
  if (session.workingFolderDeleted) {
    return (
      <Stack direction="column" gap={2} grow>
        <FolderRow session={session} />
        <EmptyMessage>{FOLDER_DELETED}</EmptyMessage>
      </Stack>
    )
  }
  return <FolderTreeView key={treeKey(session)} session={session} state={state} />
}
