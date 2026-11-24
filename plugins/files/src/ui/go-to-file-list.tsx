import { useDeferredValue, useMemo, useState, type ReactNode } from "react"
import {
  ErrorMessage,
  useGitStatus,
  useOpenFile,
  type ActionFailure,
  type QuickPickItem,
  type Session,
} from "@ivin/plugin-api/ui"
import { useFileList } from "../hooks/use-file-list.ts"
import { useFolderLabel } from "../hooks/use-folder-label.ts"
import { gitMarks } from "../rules/git-marks.ts"
import { FOLDER_DELETED } from "../rules/messages.ts"
import { nameOf, parentOf } from "../rules/paths.ts"
import { indexFiles, rankFiles } from "../rules/rank-files.ts"

const GO_TO_FILE_LIMIT = 50

export function GoToFileList({
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
