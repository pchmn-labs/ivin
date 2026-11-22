import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { MarkdownProps } from "@ivin/plugin-api/ui"
import { Cause, Exit } from "effect"
import { createContext, useContext, useState, type ComponentProps, type MouseEvent } from "react"
import { defaultUrlTransform, type ExtraProps } from "react-markdown"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import {
  Markdown,
  type MarkdownLinkRendering,
} from "../../../core/components/markdown/markdown.tsx"
import { openSessionsAtom } from "../../session/atoms/open-sessions.ts"
import { openSubViewAtom } from "../../tab/atoms/open-sub-view.ts"
import { openFileFailure } from "../../tab/rules/sub-view-failure.ts"
import { shownLinesOf } from "../atoms/shown-lines.ts"
import { fileLink, hasFileScheme, outsideFileFailure } from "../rules/file-link.ts"
import "./session-markdown.css"

// Answers true when it handled the link, so the browser does not follow it.
const OpenLinkContext = createContext<(href: string) => boolean>(() => false)

function SessionLink({ href = "", node: _node, ...rest }: ComponentProps<"a"> & ExtraProps) {
  const openLink = useContext(OpenLinkContext)
  const follow = (event: MouseEvent) => {
    if (openLink(href)) event.preventDefault()
  }
  return (
    <a
      {...rest}
      href={href}
      onClick={follow}
      onAuxClick={(event) => event.button === 1 && follow(event)}
    />
  )
}

const linkRendering: MarkdownLinkRendering = {
  component: SessionLink,
  urlTransform: (url) => (hasFileScheme(url) ? url : defaultUrlTransform(url)),
}

let lastRequest = 0

interface LinkFailure {
  readonly text: string
  readonly retry?: () => void
}

function LinkedMarkdown({ text, sessionId }: { text: string; sessionId: string }) {
  const session = useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)
  const open = useAtomSet(openSubViewAtom, { mode: "promiseExit" })
  const registry = useContext(RegistryContext)
  const [failure, setFailure] = useState<LinkFailure | null>(null)

  const openLink = (href: string) => {
    if (session === undefined) return false
    const { workingFolder } = session
    const link = fileLink(href, workingFolder)
    if (link.kind === "none") return false
    setFailure(null)
    if (link.kind === "outside") {
      setFailure({ text: outsideFileFailure(link.path) })
      return true
    }
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

  return (
    <OpenLinkContext.Provider value={openLink}>
      <Markdown text={text} linkRendering={linkRendering} />
      {failure && (
        <div className="iv-session-markdown__failure">
          <ErrorMessage message={failure.text} {...(failure.retry && { onRetry: failure.retry })} />
        </div>
      )}
    </OpenLinkContext.Provider>
  )
}

export function SessionMarkdown({ text, sessionId }: MarkdownProps) {
  return sessionId === undefined ? (
    <Markdown text={text} />
  ) : (
    <LinkedMarkdown text={text} sessionId={sessionId} />
  )
}
