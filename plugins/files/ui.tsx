import { useEffect, useState } from "react"
import {
  ErrorMessage,
  Icon,
  Stack,
  Text,
  Tree,
  defineUi,
  useListFolder,
  useOpenFile,
  useProjects,
  useSelectedSessionId,
  useSession,
  type FolderEntry,
  type ActionFailure,
  type FolderListing,
  type Session,
} from "@ivin/plugin-api/ui"
import { folderLabel } from "./rules/folder-label.ts"
import { treeRows } from "./rules/tree-rows.ts"

type FolderState = { readonly kind: "loading" } | FolderListing

interface FolderTree {
  readonly open: ReadonlySet<string>
  readonly folders: ReadonlyMap<string, FolderState>
}

const NOTHING_OPEN: FolderTree = { open: new Set(), folders: new Map() }

// A session moved to another working folder starts a new tree.
const treeKey = (session: Session) => `${session.id}\n${session.workingFolder}`

const FOLDER_DELETED = "This session's working folder was deleted, so it has no files to show."

function Message({ children }: { children: string }) {
  return (
    <Text size="sm" tone="faint">
      {children}
    </Text>
  )
}

function FolderTreeView({
  session,
  remembered,
  collapseAll,
}: {
  session: Session
  remembered: Map<string, FolderTree>
  collapseAll: Set<() => void>
}) {
  const listFolder = useListFolder()
  const openFile = useOpenFile()
  const [openFailure, setOpenFailure] = useState<({ path: string } & ActionFailure) | null>(null)
  const open = async (path: string) => {
    setOpenFailure(null)
    const failure = await openFile(session.id, path)
    if (failure !== undefined) setOpenFailure({ path, ...failure })
  }
  const key = treeKey(session)
  const [tree, setTree] = useState(() => remembered.get(key) ?? NOTHING_OPEN)
  useEffect(() => {
    remembered.set(key, tree)
  }, [remembered, key, tree])

  const load = (path: string) => {
    setTree((current) =>
      // A folder listed before keeps its rows while it is listed again.
      current.folders.get(path)?.kind === "listed"
        ? current
        : { ...current, folders: new Map(current.folders).set(path, { kind: "loading" }) },
    )
    void listFolder(session.id, path).then((listing) =>
      setTree((current) => ({ ...current, folders: new Map(current.folders).set(path, listing) })),
    )
  }

  // What was open in this session is listed again, as the agent may have changed it meanwhile.
  const [openOnMount] = useState(tree.open)
  useEffect(() => {
    for (const path of ["", ...openOnMount]) load(path)
  }, [])

  useEffect(() => {
    const run = () => setTree((current) => ({ ...current, open: new Set() }))
    collapseAll.add(run)
    return () => void collapseAll.delete(run)
  }, [collapseAll])

  const toggle = (path: string) => {
    const open = new Set(tree.open)
    if (open.delete(path)) return setTree({ ...tree, open })
    open.add(path)
    setTree({ ...tree, open })
    load(path)
  }

  const root = tree.folders.get("")
  if (root?.kind === "deleted") {
    return <Message>{FOLDER_DELETED}</Message>
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
    return <Message>This folder is empty.</Message>
  }

  const listed = new Map<string, ReadonlyArray<FolderEntry>>()
  const failedFolders: Array<{ path: string; text: string; retryable: boolean }> = []
  for (const [path, state] of tree.folders) {
    if (state.kind === "listed") listed.set(path, state.entries)
    if (state.kind === "failed" && tree.open.has(path))
      failedFolders.push({ path, ...state.failure })
  }
  return (
    <Stack direction="column" gap={2} grow>
      {failedFolders.map(({ path, text, retryable }) => (
        <ErrorMessage key={path} message={text} {...(retryable && { onRetry: () => load(path) })} />
      ))}
      {openFailure !== null && (
        <ErrorMessage
          message={openFailure.text}
          {...(openFailure.retryable && { onRetry: () => void open(openFailure.path) })}
        />
      )}
      <Tree
        label="Files"
        rows={treeRows(listed, tree.open)}
        onToggle={toggle}
        onOpen={(path) => void open(path)}
      />
    </Stack>
  )
}

function FilesPanel({
  remembered,
  collapseAll,
}: {
  remembered: Map<string, FolderTree>
  collapseAll: Set<() => void>
}) {
  const sessionId = useSelectedSessionId()
  const session = useSession(sessionId ?? "")
  const { projects } = useProjects()
  if (sessionId === null) {
    return <Message>No session on screen. Open one to see the files of its working folder.</Message>
  }
  if (session === undefined) return null
  const project = projects.find((p) => p.path === session.projectPath)
  return (
    <Stack direction="column" gap={2} grow>
      <Stack direction="row" gap={1} align="center">
        <Icon name={session.inWorktree ? "worktree" : "folder"} size={12} />
        <Text size="xs" tone="faint" mono truncate title={session.workingFolder}>
          {folderLabel(session.workingFolder, session.projectPath, project?.name ?? "")}
        </Text>
      </Stack>
      {session.workingFolderDeleted ? (
        <Message>{FOLDER_DELETED}</Message>
      ) : (
        <FolderTreeView
          key={treeKey(session)}
          session={session}
          remembered={remembered}
          collapseAll={collapseAll}
        />
      )}
    </Stack>
  )
}

export const activate = defineUi((ctx) => {
  // What each session had open, for as long as the plugin is active.
  const remembered = new Map<string, FolderTree>()
  // The mounted tree's collapse, for the command to reach.
  const collapseAll = new Set<() => void>()
  ctx.slots.add(
    "sidebar.panel",
    () => <FilesPanel remembered={remembered} collapseAll={collapseAll} />,
    {
      name: "panel",
      title: "Files",
    },
  )
  ctx.commands.register("files.show", {
    title: "Show files",
    run: () => ctx.sidebar.showPanel("panel"),
  })
  ctx.keybindings.add({ key: "mod+2", command: "files.show" })
  ctx.commands.register("files.collapseAll", {
    title: "Collapse all folders",
    run: () => collapseAll.forEach((run) => run()),
  })
})
