import { useEffect, useState } from "react"
import { QuickPick, useSelectedSessionId, useSession } from "@ivin/plugin-api/ui"
import { FOLDER_DELETED } from "../rules/messages.ts"
import { treeKey, type PluginState } from "../rules/plugin-state.ts"
import { GoToFileList } from "./go-to-file-list.tsx"

export function GoToFile({ state }: { state: PluginState }) {
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
