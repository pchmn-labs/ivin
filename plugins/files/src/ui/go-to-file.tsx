import { useEffect, useState } from "react"
import { QuickPick, useSelectedSessionId, useSession } from "@ivin/plugin-api/ui"
import { FOLDER_DELETED } from "../rules/messages.ts"
import { treeKey } from "../rules/plugin-state.ts"
import { GoToFileList } from "./go-to-file-list.tsx"

export function GoToFile({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState("")
  useEffect(() => {
    if (open) setQuery("")
  }, [open])
  const sessionId = useSelectedSessionId()
  const session = useSession(sessionId ?? "")
  const common = {
    open,
    onOpenChange,
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
      onPicked={() => onOpenChange(false)}
    >
      {(props) => <QuickPick {...common} {...props} />}
    </GoToFileList>
  )
}
