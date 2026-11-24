import type { CodeBlockProps } from "@ivin/plugin-api/ui"
import { CopyButton } from "../copy-button/copy-button.tsx"
import "./code-block.css"

export type { CodeBlockProps }

const maxLines = 2000

const firstLines = (text: string) => {
  let end = -1
  for (let i = 0; i < maxLines; i++) {
    end = text.indexOf("\n", end + 1)
    if (end === -1) return null
  }
  return { shown: text.slice(0, end), total: text.split("\n").length }
}

export function CodeBlock({ text, "data-testid": testId }: CodeBlockProps) {
  const cut = firstLines(text)
  return (
    <div className="iv-code-block">
      <pre className="iv-code-block__text" data-testid={testId}>
        {cut === null ? text : cut.shown}
      </pre>
      {cut !== null && cut.total > maxLines && (
        <p className="iv-code-block__note">
          Showing the first {maxLines.toLocaleString("en-US")} of{" "}
          {cut.total.toLocaleString("en-US")} lines.
        </p>
      )}
      <CopyButton text={() => text} />
    </div>
  )
}
