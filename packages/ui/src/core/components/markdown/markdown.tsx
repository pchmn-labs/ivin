import { memo, useRef, type ComponentProps, type ComponentType } from "react"
import ReactMarkdown, { type UrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"
import "./markdown.css"
import { extendBlocks, splitBlocks } from "../../../modules/transcript/rules/split-blocks.ts"

export interface MarkdownLinks {
  readonly component: ComponentType<ComponentProps<"a">>
  readonly urlTransform: UrlTransform
}

interface BlockProps {
  readonly source: string
  readonly links: MarkdownLinks | undefined
}

const Block = memo(function Block({ source, links }: BlockProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      {...(links && { components: { a: links.component }, urlTransform: links.urlTransform })}
    >
      {source}
    </ReactMarkdown>
  )
})

// `links` keeps its identity across renders, or every block renders again.
export function Markdown({ text, links }: { text: string; links?: MarkdownLinks }) {
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
        <Block key={index} source={source} links={links} />
      ))}
    </div>
  )
}
