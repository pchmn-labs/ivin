import { useEffect, useMemo, useRef, useState } from "react"
import {
  ErrorMessage,
  IconButton,
  SearchField,
  Stack,
  useFileOnScreen,
  useFolderChanges,
  useGitStatus,
  useGitStatusFailure,
  useListFolder,
  useOpenFile,
  type ActionFailure,
  type Session,
} from "@ivin/plugin-api/ui"
import {
  foldersToReload,
  listedFolders,
  withListing,
  type FolderTree,
} from "../rules/folder-tree.ts"
import { gitMarks } from "../rules/git-marks.ts"
import { ancestorsOf } from "../rules/paths.ts"
import { NOTHING_OPEN, treeKey, type PluginState } from "../rules/plugin-state.ts"
import { treeRows } from "../rules/tree-rows.ts"
import { FilteredContent } from "./filtered-content.tsx"
import { FolderContent } from "./folder-content.tsx"
import { FolderRow } from "./folder-row.tsx"

export function FolderTreeView({ session, state }: { session: Session; state: PluginState }) {
  const listFolder = useListFolder()
  const openFile = useOpenFile()
  const statuses = useGitStatus(session.id)
  const marks = useMemo(() => gitMarks(statuses), [statuses])
  const statusFailure = useGitStatusFailure(session.id)
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
