import type { MarkdownProps } from "@ivin/plugin-api/ui"
import { createContext, useContext, type ComponentProps, type MouseEvent } from "react"
import { defaultUrlTransform, type ExtraProps } from "react-markdown"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import {
  Markdown,
  useInCodeBlock,
  type MarkdownLinkRendering,
} from "../../../core/components/markdown/markdown.tsx"
import { useOpenFileLink } from "../hooks/use-open-file-link.ts"
import { hasFileScheme, isPathShaped, type FileLink } from "../rules/file-link.ts"
import "./session-markdown.css"

interface Links {
  readonly linkOf: (href: string) => FileLink
  // Answers true when it handled the link, so the browser does not follow it.
  readonly openLink: (href: string) => boolean
}

const LinksContext = createContext<Links>({
  linkOf: () => ({ kind: "none" }),
  openLink: () => false,
})
const InLink = createContext(false)

function SessionLink({ href = "", node: _node, ...rest }: ComponentProps<"a"> & ExtraProps) {
  const { openLink } = useContext(LinksContext)
  const follow = (event: MouseEvent) => {
    if (openLink(href)) event.preventDefault()
  }
  return (
    <InLink.Provider value={true}>
      <a
        {...rest}
        href={href}
        onClick={follow}
        onAuxClick={(event) => event.button === 1 && follow(event)}
      />
    </InLink.Provider>
  )
}

function SessionInlineCode({ node: _node, ...props }: ComponentProps<"code"> & ExtraProps) {
  const { linkOf, openLink } = useContext(LinksContext)
  const inLink = useContext(InLink)
  const inBlock = useInCodeBlock()
  const text = typeof props.children === "string" ? props.children : null
  if (inLink || inBlock || text === null || !isPathShaped(text) || linkOf(text).kind === "none") {
    return <code {...props} />
  }
  const follow = (event: MouseEvent) => {
    event.preventDefault()
    openLink(text)
  }
  return (
    <a
      className="iv-session-markdown__path"
      href={text}
      onClick={follow}
      onAuxClick={(event) => event.button === 1 && follow(event)}
    >
      <code {...props} />
    </a>
  )
}

const linkRendering: MarkdownLinkRendering = {
  component: SessionLink,
  urlTransform: (url) => (hasFileScheme(url) ? url : defaultUrlTransform(url)),
  code: SessionInlineCode,
}

function LinkedMarkdown({ text, sessionId }: { text: string; sessionId: string }) {
  const { linkOf, openLink, failure } = useOpenFileLink(sessionId)
  return (
    <LinksContext.Provider value={{ linkOf, openLink }}>
      <Markdown text={text} linkRendering={linkRendering} />
      {failure && (
        <div className="iv-session-markdown__failure">
          <ErrorMessage message={failure.text} {...(failure.retry && { onRetry: failure.retry })} />
        </div>
      )}
    </LinksContext.Provider>
  )
}

export function SessionMarkdown({ text, sessionId }: MarkdownProps) {
  return sessionId === undefined ? (
    <Markdown text={text} />
  ) : (
    <LinkedMarkdown text={text} sessionId={sessionId} />
  )
}
