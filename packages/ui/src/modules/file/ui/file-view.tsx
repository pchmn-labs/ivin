import { RegistryContext, useAtomRefresh, useAtomValue } from "@effect/atom-react"
import { Cause } from "effect"
import { useContext, useEffect, useState } from "react"
import { AsyncResult } from "effect/reactivity"
import { CodeView } from "../../../core/components/code-view/code-view.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { fileContentOf } from "../atoms/read-file.ts"
import { fileScrollOf } from "../atoms/file-scroll.ts"
import { shownLinesOf } from "../atoms/shown-lines.ts"
import { fileName } from "../rules/file-name.ts"
import { fileReading, fileReadingFailure } from "../rules/file-reading.ts"
import "./file-view.css"

export function FileView({
  sessionId,
  workingFolder,
  path,
}: {
  sessionId: string
  workingFolder: string
  path: string
}) {
  const atom = fileContentOf(sessionId, workingFolder, path)
  const result = useAtomValue(atom)
  const retry = useAtomRefresh(atom)
  const registry = useContext(RegistryContext)
  const scroll = fileScrollOf(sessionId, workingFolder, path)
  // Read once, not subscribed: each scroll writes it.
  const [scrollTop] = useState(() => registry.get(scroll))
  const shownLinesAtom = shownLinesOf(sessionId, workingFolder, path)
  const shownLines = useAtomValue(shownLinesAtom)
  useEffect(() => () => registry.set(shownLinesAtom, undefined), [registry, shownLinesAtom])

  if (AsyncResult.isInitial(result)) return <div className="iv-file-view" />
  const reading = AsyncResult.isSuccess(result)
    ? fileReading(result.value, path)
    : fileReadingFailure(Cause.squash(result.cause), path)

  if (reading.kind === "text") {
    return (
      <div className="iv-file-view">
        <CodeView
          text={reading.text}
          fileName={fileName(path)}
          scrollTop={scrollTop}
          onScroll={(top) => registry.set(scroll, top)}
          {...(shownLines && { shownLines })}
        />
      </div>
    )
  }
  return (
    <div className="iv-file-view iv-file-view--message">
      {AsyncResult.isFailure(result) ? (
        <ErrorMessage message={reading.text} {...(reading.retryable && { onRetry: retry })} />
      ) : (
        <Text tone="muted">{reading.text}</Text>
      )}
    </div>
  )
}
