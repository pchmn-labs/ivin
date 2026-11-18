import type { CodeBlockProps } from "@ivin/plugin-api/ui"
import "./code-block.css"

export type { CodeBlockProps }

export function CodeBlock({ text, "data-testid": testId }: CodeBlockProps) {
  return (
    <pre className="iv-code-block" data-testid={testId}>
      {text}
    </pre>
  )
}
