import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Cause, Exit } from "effect"
import { useContext, useState } from "react"
import { openSessionsAtom } from "../../session/atoms/open-sessions.ts"
import { openSubViewAtom } from "../../tab/atoms/open-sub-view.ts"
import { openFileFailure } from "../../tab/rules/sub-view-failure.ts"
import { shownLinesOf } from "../atoms/shown-lines.ts"
import { fileLink, type FileLink } from "../rules/file-link.ts"

export interface OpenFileLinkFailure {
  readonly text: string
  readonly retry?: () => void
}

let lastRequest = 0

// `linkOf` answers `none` for what opens no file, and before the session is known.
export function useOpenFileLink(sessionId: string) {
  const session = useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)
  const open = useAtomSet(openSubViewAtom, { mode: "promiseExit" })
  const registry = useContext(RegistryContext)
  const [failure, setFailure] = useState<OpenFileLinkFailure | null>(null)

  const linkOf = (href: string): FileLink =>
    session === undefined ? { kind: "none" } : fileLink(href, session.workingFolder)

  // Answers true when `href` names a file, so the caller keeps the browser from following it.
  const openLink = (href: string): boolean => {
    const link = linkOf(href)
    if (session === undefined || link.kind === "none") return false
    const { workingFolder } = session
    const openFile = async () => {
      setFailure(null)
      const shownLines = shownLinesOf(sessionId, workingFolder, link.path)
      registry.set(shownLines, link.lines && { ...link.lines, request: ++lastRequest })
      const exit = await open({
        sessionId,
        workingFolder,
        subView: { kind: "file", path: link.path },
      })
      if (Exit.isSuccess(exit)) return
      registry.set(shownLines, undefined)
      const { text, retryable } = openFileFailure(Cause.squash(exit.cause), link.path)
      setFailure({ text, ...(retryable && { retry: () => void openFile() }) })
    }
    void openFile()
    return true
  }

  return { linkOf, openLink, failure, workingFolder: session?.workingFolder }
}
