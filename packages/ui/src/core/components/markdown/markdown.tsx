import { memo, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import "./markdown.css"
import { extendBlocks, splitBlocks } from "../../../modules/transcript/rules/split-blocks.ts"

const Block = memo(function Block({ source }: { source: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
})

export function Markdown({ text }: { text: string }) {
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
        <Block key={index} source={source} />
      ))}
    </div>
  )
}
