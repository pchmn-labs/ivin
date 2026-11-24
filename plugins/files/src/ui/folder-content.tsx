import { EmptyMessage, ErrorMessage, Tree, type ActionFailure } from "@ivin/plugin-api/ui"
import { FOLDER_DELETED } from "../rules/messages.ts"
import type { FolderState, FolderTree } from "../rules/folder-tree.ts"
import type { treeRows } from "../rules/tree-rows.ts"
import { OpenFailure } from "./open-failure.tsx"

export function FolderContent({
  tree,
  rows,
  load,
  toggle,
  openFailure,
  open,
  revealId,
}: {
  tree: FolderTree
  rows: ReturnType<typeof treeRows>
  load: (path: string) => void
  toggle: (path: string) => void
  openFailure: ({ path: string } & ActionFailure) | null
  open: (path: string) => Promise<void>
  revealId: string | null
}) {
  const root: FolderState | undefined = tree.folders.get("")
  if (root?.kind === "deleted") {
    return <EmptyMessage>{FOLDER_DELETED}</EmptyMessage>
  }
  if (root?.kind === "failed") {
    return (
      <ErrorMessage
        message={root.failure.text}
        {...(root.failure.retryable && { onRetry: () => load("") })}
      />
    )
  }
  if (root?.kind === "listed" && root.entries.length === 0) {
    return <EmptyMessage>This folder is empty.</EmptyMessage>
  }

  const failedFolders: Array<{ path: string; text: string; retryable: boolean }> = []
  for (const [path, state] of tree.folders)
    if (state.kind === "failed" && tree.open.has(path))
      failedFolders.push({ path, ...state.failure })
  return (
    <>
      {failedFolders.map(({ path, text, retryable }) => (
        <ErrorMessage key={path} message={text} {...(retryable && { onRetry: () => load(path) })} />
      ))}
      <OpenFailure failure={openFailure} open={open} />
      <Tree
        label="Files"
        rows={rows}
        onToggle={toggle}
        onOpen={(path) => void open(path)}
        revealId={revealId}
      />
    </>
  )
}
