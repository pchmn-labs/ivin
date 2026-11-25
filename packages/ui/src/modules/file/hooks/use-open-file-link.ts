import { RegistryContext, useAtomValue } from "@effect/atom-react"
import { useContext, useState } from "react"
import { openSessionsAtom } from "../../session/atoms/open-sessions.ts"
import { runOpenView } from "../../view/atoms/open-view.ts"
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
      const failed = await runOpenView(
        registry,
        { sessionId, view: "files/file", params: { path: link.path } },
        (error) => openFileFailure(error, link.path),
      )
      if (failed === undefined) return
      registry.set(shownLines, undefined)
      const { text, retryable } = failed
      setFailure({ text, ...(retryable && { retry: () => void openFile() }) })
    }
    void openFile()
    return true
  }

  return { linkOf, openLink, failure, workingFolder: session?.workingFolder }
}
