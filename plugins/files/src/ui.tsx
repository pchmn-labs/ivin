import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ErrorMessage,
  Icon,
  IconButton,
  QuickPick,
  SearchField,
  Stack,
  Text,
  Tree,
  defineUi,
  useFileOnScreen,
  useFolderChanges,
  useGitStatus,
  useListFiles,
  useListFolder,
  useOpenFile,
  useProjects,
  useSelectedSessionId,
  useSession,
  type ActionFailure,
  type FileListing,
  type FolderEntry,
  type QuickPickItem,
  type Session,
} from "@ivin/plugin-api/ui"
import { filterRows } from "./rules/filter-rows.ts"
import { folderLabel } from "./rules/folder-label.ts"
import {
  foldersToReload,
  withListing,
  type FolderState,
  type FolderTree,
} from "./rules/folder-tree.ts"
import { gitMarks } from "./rules/git-marks.ts"
import { keepListing } from "./rules/keep-listing.ts"
import { ancestorsOf, nameOf, parentOf } from "./rules/paths.ts"
import { indexFiles, rankFiles } from "./rules/rank-files.ts"
import { treeRows } from "./rules/tree-rows.ts"

const GO_TO_FILE_LIMIT = 50
const LIST_TRUNCATED =
  "This folder holds too many files to search them all, so only the first ones are searched."

interface SessionView {
  readonly tree: FolderTree
  readonly filter: string
}

const NOTHING_OPEN: SessionView = { tree: { open: new Set(), folders: new Map() }, filter: "" }

// Lives as long as the plugin is active.
interface PluginState {
  // What each session had open, and its filter.
  readonly remembered: Map<string, SessionView>
  showIgnored: boolean
  readonly collapseAll: Set<() => void>
  readonly toggleIgnored: Set<() => void>
  readonly openGoToFile: Set<() => void>
}

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

function useFolderLabel(session: Session) {
  const { projects } = useProjects()
  const project = projects.find((p) => p.path === session.projectPath)
  return folderLabel(session.workingFolder, session.projectPath, project?.name ?? "")
}

function FolderRow({ session }: { session: Session }) {
  return (
    <Stack direction="row" gap={1} align="center">
      <Icon name={session.inWorktree ? "worktree" : "folder"} size={12} />
      <Text size="xs" tone="faint" mono truncate title={session.workingFolder}>
        {useFolderLabel(session)}
      </Text>
    </Stack>
  )
}

// Listed again after each change on disk while `active`.
function useFileList(session: Session, active: boolean) {
  const listFiles = useListFiles()
  const [listing, setListing] = useState<FileListing | null>(null)
  const asked = useRef(0)
  const shown = useRef(0)
  const load = () => {
    const call = ++asked.current
    void listFiles(session.id).then((next) => {
      // A listing asked before the one shown is older, however late it arrives.
      if (call < shown.current) return
      shown.current = call
      setListing((current) => keepListing(current, next))
    })
  }
  useEffect(() => {
    if (active) load()
    else {
      shown.current = ++asked.current
      setListing(null)
    }
  }, [active])
  useFolderChanges(session.id, (paths) => {
    if (active && paths.length > 0) load()
  })
  return { listing, retry: load }
}

function FolderTreeView({ session, state }: { session: Session; state: PluginState }) {
  const listFolder = useListFolder()
  const openFile = useOpenFile()
  const { entries: statuses, ...statusFailure } = useGitStatus(session.id)
  const marks = useMemo(() => gitMarks(statuses), [statuses])
  const [openFailure, setOpenFailure] = useState<({ path: string } & ActionFailure) | null>(null)
  const open = async (path: string) => {
    setOpenFailure(null)
    const failure = await openFile(session.id, path)
    if (failure !== undefined) setOpenFailure({ path, ...failure })
  }
  const key = treeKey(session)
  const [view, setView] = useState(() => state.remembered.get(key) ?? NOTHING_OPEN)
  const { tree, filter } = view
  useEffect(() => {
    state.remembered.set(key, view)
  }, [state, key, view])
  const latest = useRef(tree)
  useEffect(() => {
    latest.current = tree
  }, [tree])
  const setTree = (update: (current: FolderTree) => FolderTree) =>
    setView((current) => ({ ...current, tree: update(current.tree) }))
  const setFilter = (next: string) => setView((current) => ({ ...current, filter: next }))

  const [showIgnored, setShowIgnored] = useState(state.showIgnored)
  useEffect(() => {
    state.showIgnored = showIgnored
  }, [state, showIgnored])

  const load = (path: string) => {
    setTree((current) =>
      // A folder listed before keeps its rows while it is listed again.
      current.folders.get(path)?.kind === "listed"
        ? current
        : { ...current, folders: new Map(current.folders).set(path, { kind: "loading" }) },
    )
    return listFolder(session.id, path).then((listing) => {
      setTree((current) => withListing(current, path, listing))
      return listing
    })
  }

  // What was open in this session is listed again, as the agent may have changed it meanwhile.
  const [openOnMount] = useState(tree.open)
  useEffect(() => {
    for (const path of ["", ...openOnMount]) void load(path)
  }, [])

  useFolderChanges(session.id, (paths) => {
    void (async () => {
      // Parents first, so a folder deleted with its parent is never listed and reported missing.
      let batch: FolderTree = latest.current
      for (const folder of foldersToReload(batch, paths)) {
        if (batch.folders.get(folder)?.kind !== "listed") continue
        batch = withListing(batch, folder, await load(folder))
      }
    })()
  })

  const fileOnScreen = useFileOnScreen(session.id)
  useEffect(() => {
    if (fileOnScreen === null) return
    const folders = ancestorsOf(fileOnScreen)
    setTree((current) => ({ ...current, open: new Set([...current.open, ...folders]) }))
    for (const folder of folders)
      if (latest.current.folders.get(folder) === undefined) void load(folder)
  }, [fileOnScreen])

  const closeAll = () => setTree((current) => ({ ...current, open: new Set() }))
  const toggleIgnored = () => setShowIgnored((shown) => !shown)
  useEffect(() => {
    state.collapseAll.add(closeAll)
    state.toggleIgnored.add(toggleIgnored)
    return () => {
      state.collapseAll.delete(closeAll)
      state.toggleIgnored.delete(toggleIgnored)
    }
  }, [state])

  const toggle = (path: string) => {
    const opened = new Set(tree.open)
    if (opened.delete(path)) return setTree((current) => ({ ...current, open: opened }))
    opened.add(path)
    setTree((current) => ({ ...current, open: opened }))
    void load(path)
  }

  return (
    <Stack direction="column" gap={2} grow>
      <Stack direction="row" gap={1} align="center">
        <SearchField
          label="Filter files by name"
          placeholder="Filter files"
          value={filter}
          onChange={setFilter}
        />
        <IconButton
          icon={showIgnored ? "eye" : "eye-slash"}
          label={showIgnored ? "Hide ignored files" : "Show ignored files"}
          aria-pressed={showIgnored}
          size="sm"
          onClick={toggleIgnored}
        />
        <IconButton
          icon="collapse-all"
          label="Collapse all folders"
          size="sm"
          disabled={tree.open.size === 0}
          onClick={closeAll}
        />
      </Stack>
      <FolderRow session={session} />
      {statusFailure.failure !== null && (
        <ErrorMessage
          message={statusFailure.failure.text}
          {...(statusFailure.failure.retryable && { onRetry: statusFailure.retry })}
        />
      )}
      {filter.trim() === "" ? (
        <FolderContent
          tree={tree}
          rows={treeRows(listedFolders(tree), tree.open, { showIgnored, statuses: marks })}
          load={(path) => void load(path)}
          toggle={toggle}
          openFailure={openFailure}
          open={open}
          revealId={fileOnScreen}
        />
      ) : (
        <FilteredContent
          session={session}
          filter={filter}
          marks={marks}
          openFailure={openFailure}
          open={open}
          revealId={fileOnScreen}
        />
      )}
    </Stack>
  )
}

const listedFolders = (tree: FolderTree) => {
  const listed = new Map<string, ReadonlyArray<FolderEntry>>()
  for (const [path, state] of tree.folders)
    if (state.kind === "listed") listed.set(path, state.entries)
  return listed
}

function OpenFailure({
  failure,
  open,
}: {
  failure: ({ path: string } & ActionFailure) | null
  open: (path: string) => Promise<void>
}) {
  if (failure === null) return null
  return (
    <ErrorMessage
      message={failure.text}
      {...(failure.retryable && { onRetry: () => void open(failure.path) })}
    />
  )
}

function FolderContent({
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

function FilteredContent({
  session,
  filter,
  marks,
  openFailure,
  open,
  revealId,
}: {
  session: Session
  filter: string
  marks: ReturnType<typeof gitMarks>
  openFailure: ({ path: string } & ActionFailure) | null
  open: (path: string) => Promise<void>
  revealId: string | null
}) {
  const { listing, retry } = useFileList(session, true)
  const query = useDeferredValue(filter)
  const rows = useMemo(
    () => (listing?.kind === "listed" ? filterRows(listing.paths, query, marks) : []),
    [listing, query, marks],
  )
  if (listing === null) return null
  if (listing.kind === "deleted") return <Message>{FOLDER_DELETED}</Message>
  if (listing.kind === "failed") {
    return (
      <ErrorMessage
        message={listing.failure.text}
        {...(listing.failure.retryable && { onRetry: retry })}
      />
    )
  }
  return (
    <>
      <OpenFailure failure={openFailure} open={open} />
      {listing.truncated && <Message>{LIST_TRUNCATED}</Message>}
      {rows.length === 0 ? (
        <Message>{`No file matches “${filter.trim()}”.`}</Message>
      ) : (
        <Tree
          label="Files"
          rows={rows}
          onToggle={() => undefined}
          onOpen={(path) => void open(path)}
          revealId={revealId}
        />
      )}
    </>
  )
}

function FilesPanel({ state }: { state: PluginState }) {
  const sessionId = useSelectedSessionId()
  const session = useSession(sessionId ?? "")
  if (sessionId === null) {
    return <Message>No session on screen. Open one to see the files of its working folder.</Message>
  }
  if (session === undefined) return null
  if (session.workingFolderDeleted) {
    return (
      <Stack direction="column" gap={2} grow>
        <FolderRow session={session} />
        <Message>{FOLDER_DELETED}</Message>
      </Stack>
    )
  }
  return <FolderTreeView key={treeKey(session)} session={session} state={state} />
}

function GoToFileList({
  session,
  query,
  onPicked,
  children,
}: {
  session: Session
  query: string
  onPicked: () => void
  children: (props: {
    items: ReadonlyArray<QuickPickItem>
    message?: ReactNode
    footer?: string
    placeholder: string
    onPick: (path: string) => void
  }) => ReactNode
}) {
  const { listing, retry } = useFileList(session, true)
  const { entries: statuses } = useGitStatus(session.id)
  const marks = useMemo(() => gitMarks(statuses), [statuses])
  const openFile = useOpenFile()
  const [failure, setFailure] = useState<({ path: string } & ActionFailure) | null>(null)
  const placeholder = `Go to a file in ${useFolderLabel(session)}`
  const deferred = useDeferredValue(query)
  const index = useMemo(
    () => (listing?.kind === "listed" ? indexFiles(listing.paths) : null),
    [listing],
  )
  const ranked = useMemo(
    () => (index === null ? [] : rankFiles(index, deferred, GO_TO_FILE_LIMIT)),
    [index, deferred],
  )
  const onPick = async (path: string) => {
    setFailure(null)
    const failed = await openFile(session.id, path)
    if (failed === undefined) onPicked()
    else setFailure({ path, ...failed })
  }
  const items = ranked.map(({ path, nameMatch }): QuickPickItem => {
    const status = marks.get(path)
    const folder = parentOf(path)
    return {
      id: path,
      label: nameOf(path),
      ...(nameMatch !== null && { match: nameMatch }),
      ...(folder !== "" && { detail: folder }),
      ...(status !== undefined && { status }),
    }
  })
  const base = { items, placeholder, onPick: (path: string) => void onPick(path) }
  if (failure !== null)
    return children({
      ...base,
      message: (
        <ErrorMessage
          message={failure.text}
          {...(failure.retryable && { onRetry: () => void onPick(failure.path) })}
        />
      ),
    })
  if (listing === null) return children({ ...base, message: "Listing files…" })
  if (listing.kind === "deleted") return children({ ...base, message: FOLDER_DELETED })
  if (listing.kind === "failed")
    return children({
      ...base,
      message: (
        <ErrorMessage
          message={listing.failure.text}
          {...(listing.failure.retryable && { onRetry: retry })}
        />
      ),
    })
  const count = listing.paths.length
  const footer = listing.truncated
    ? `First ${count.toLocaleString("en-US")} files`
    : `${count.toLocaleString("en-US")} ${count === 1 ? "file" : "files"}`
  if (count === 0)
    return children({ ...base, footer, message: "This working folder has no files." })
  if (items.length === 0)
    return children({
      ...base,
      footer,
      message: `No file in the working folder matches “${query.trim()}”.`,
    })
  return children({ ...base, footer })
}

function GoToFile({ state }: { state: PluginState }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  useEffect(() => {
    const show = () => {
      setQuery("")
      setOpen(true)
    }
    state.openGoToFile.add(show)
    return () => void state.openGoToFile.delete(show)
  }, [state])
  const sessionId = useSelectedSessionId()
  const session = useSession(sessionId ?? "")
  const common = {
    open,
    onOpenChange: setOpen,
    label: "Go to file",
    query,
    onQueryChange: setQuery,
  }
  if (!open || session === undefined || session.workingFolderDeleted) {
    return (
      <QuickPick
        {...common}
        placeholder="Go to a file"
        items={[]}
        onPick={() => undefined}
        message={
          session?.workingFolderDeleted === true
            ? FOLDER_DELETED
            : "No session on screen. Open one to go to its files."
        }
      />
    )
  }
  return (
    <GoToFileList
      key={treeKey(session)}
      session={session}
      query={query}
      onPicked={() => setOpen(false)}
    >
      {(props) => <QuickPick {...common} {...props} />}
    </GoToFileList>
  )
}

export const activate = defineUi((ctx) => {
  const state: PluginState = {
    remembered: new Map(),
    showIgnored: false,
    collapseAll: new Set(),
    toggleIgnored: new Set(),
    openGoToFile: new Set(),
  }
  ctx.slots.add("sidebar.panel", () => <FilesPanel state={state} />, {
    name: "panel",
    title: "Files",
  })
  ctx.slots.add("window.overlay", () => <GoToFile state={state} />, { name: "goToFile" })
  ctx.commands.register("files.show", {
    title: "Show files",
    run: () => ctx.sidebar.showPanel("panel"),
  })
  ctx.keybindings.add({ key: "mod+2", command: "files.show" })
  ctx.commands.register("files.collapseAll", {
    title: "Collapse all folders",
    run: () => state.collapseAll.forEach((run) => run()),
  })
  ctx.commands.register("files.toggleIgnored", {
    title: "Show or hide ignored files",
    run: () => {
      if (state.toggleIgnored.size === 0) state.showIgnored = !state.showIgnored
      state.toggleIgnored.forEach((run) => run())
    },
  })
  ctx.commands.register("files.goToFile", {
    title: "Go to file",
    run: () => state.openGoToFile.forEach((run) => run()),
  })
  ctx.keybindings.add({ key: "mod+p", command: "files.goToFile" })
})
