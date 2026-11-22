import { memo, useRef, type ComponentProps, type ComponentType } from "react"
import ReactMarkdown, { type Components, type UrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"
import { CopyButton } from "../copy-button/copy-button.tsx"
import "./markdown.css"
import { extendBlocks, splitBlocks } from "../../../modules/transcript/rules/split-blocks.ts"

export interface MarkdownLinkRendering {
  readonly component: ComponentType<ComponentProps<"a">>
  readonly urlTransform: UrlTransform
}

interface BlockProps {
  readonly source: string
  readonly linkRendering: MarkdownLinkRendering | undefined
}

function MarkdownCode({ node: _node, ...props }: ComponentProps<"pre"> & { node?: unknown }) {
  const pre = useRef<HTMLPreElement>(null)
  return (
    <div className="iv-markdown__code">
      <pre {...props} ref={pre} />
      <CopyButton text={() => pre.current?.textContent ?? ""} />
    </div>
  )
}

const Block = memo(function Block({ source, linkRendering }: BlockProps) {
  const components: Components = linkRendering
    ? { pre: MarkdownCode, a: linkRendering.component }
    : { pre: MarkdownCode }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      {...(linkRendering && { urlTransform: linkRendering.urlTransform })}
    >
      {source}
    </ReactMarkdown>
  )
})

// `linkRendering` keeps its identity across renders, or every block renders again.
export function Markdown({
  text,
  linkRendering,
}: {
  text: string
  linkRendering?: MarkdownLinkRendering
}) {
  const previous = useRef<{ text: string; blocks: ReadonlyArray<string> }>({
    text: "",
    blocks: [],
  })
  const blocks =
    previous.current.text === text
      ? previous.current.blocks
      : previous.current.blocks.length === 0
        ? splitBlocks(text)
        : extendBlocks(previous.current, text)
  previous.current = { text, blocks }
  return (
    <div className="iv-markdown">
      {blocks.map((source, index) => (
        <Block key={index} source={source} linkRendering={linkRendering} />
      ))}
    </div>
  )
}
