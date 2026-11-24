import type { FilePathProps } from "@ivin/plugin-api/ui"
import type { MouseEvent } from "react"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { useOpenFileLink } from "../hooks/use-open-file-link.ts"
import "./file-path.css"

export function FilePath({ sessionId, path }: FilePathProps) {
  const { linkOf, openLink, failure } = useOpenFileLink(sessionId)
  if (linkOf(path).kind === "none") return <span className="iv-file-path__text">{path}</span>
  const open = (event: MouseEvent) => {
    // Inside a row that folds, the click opens the file and leaves the row as it is.
    event.preventDefault()
    event.stopPropagation()
    openLink(path)
  }
  return (
    <span className="iv-file-path">
      <a className="iv-file-path__link" href={path} onClick={open}>
        {path}
      </a>
      {failure && (
        <ErrorMessage message={failure.text} {...(failure.retry && { onRetry: failure.retry })} />
      )}
    </span>
  )
}
