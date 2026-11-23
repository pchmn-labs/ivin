import { useAtomRefresh, useAtomValue } from "@effect/atom-react"
import { Cause } from "effect"
import { AsyncResult } from "effect/reactivity"
import { useDeferredValue, useMemo } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { CodeBlock } from "../../../core/components/code-block/code-block.tsx"
import { CodeView } from "../../../core/components/code-view/code-view.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { diffOf } from "../atoms/read-diff.ts"
import { type DiffKind, diffReading, diffReadingFailure } from "../rules/diff-reading.ts"
import { diffDocument } from "../rules/diff-document.ts"
import { fileName } from "../rules/file-name.ts"
import "./diff-view.css"

export function DiffView({
  kind,
  sessionId,
  workingFolder,
  path,
  onOpenFile,
}: {
  kind: DiffKind
  sessionId: string
  workingFolder: string
  path: string
  onOpenFile: () => void
}) {
  const atom = diffOf(kind, sessionId, workingFolder, path)
  const retry = useAtomRefresh(atom)
  // A long diff renders in a transition, so the window keeps answering while it opens.
  const result = useDeferredValue(useAtomValue(atom))
  const reading = AsyncResult.isSuccess(result)
    ? diffReading(result.value, path, kind)
    : AsyncResult.isFailure(result)
      ? diffReadingFailure(Cause.squash(result.cause), path)
      : null
  const diff = reading?.kind === "text" ? reading.diff : null
  const document = useMemo(() => (diff === null ? null : diffDocument(diff.hunks)), [diff])
  const deletedFile = diff?.status === "deleted"

  return (
    <div className="iv-diff-view">
      <div className="iv-diff-view__head">
        <span className="iv-diff-view__path" title={path}>
          {path}
        </span>
        {diff !== null && (
          <span className="iv-diff-view__counts">
            <span className="iv-diff-view__added">+{diff.added}</span>{" "}
            <span className="iv-diff-view__deleted">−{diff.deleted}</span>
          </span>
        )}
        {!deletedFile && (
          <Button variant="ghost" size="sm" icon="file" onClick={onOpenFile}>
            Open file
          </Button>
        )}
      </div>
      {document !== null ? (
        <CodeView
          text={document.text}
          diff={document.layout}
          fileName={fileName(path)}
          data-testid="diff-view"
        />
      ) : reading !== null && reading.kind === "message" ? (
        <div className="iv-diff-view__message">
          {AsyncResult.isFailure(result) ? (
            <ErrorMessage message={reading.text} {...(reading.retryable && { onRetry: retry })} />
          ) : (
            <Text tone="muted">{reading.text}</Text>
          )}
          {reading.gitMessage !== null && <CodeBlock text={reading.gitMessage} />}
        </div>
      ) : null}
    </div>
  )
}
