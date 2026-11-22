import type { CodeBlockProps } from "@ivin/plugin-api/ui"
import { CopyButton } from "../copy-button/copy-button.tsx"
import "./code-block.css"

export type { CodeBlockProps }

export function CodeBlock({ text, "data-testid": testId }: CodeBlockProps) {
  return (
    <div className="iv-code-block">
      <pre className="iv-code-block__text" data-testid={testId}>
        {text}
      </pre>
      <CopyButton text={() => text} />
    </div>
  )
}
