import { useDeferredValue, useMemo } from "react"
import { ErrorMessage, Tree, type ActionFailure, type Session } from "@ivin/plugin-api/ui"
import { useFileList } from "../hooks/use-file-list.ts"
import { filterRows } from "../rules/filter-rows.ts"
import type { gitMarks } from "../rules/git-marks.ts"
import { FOLDER_DELETED, LIST_TRUNCATED } from "../rules/messages.ts"
import { Message } from "./message.tsx"
import { OpenFailure } from "./open-failure.tsx"

export function FilteredContent({
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
