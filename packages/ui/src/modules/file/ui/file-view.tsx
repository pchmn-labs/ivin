import { RegistryContext, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { FileNotRead } from "@ivin/contracts/file"
import { Cause } from "effect"
import { useContext, useEffect, useState } from "react"
import { AsyncResult } from "effect/reactivity"
import { Button } from "../../../core/components/button/button.tsx"
import { CodeView } from "../../../core/components/code-view/code-view.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { editorExtensionsAtom } from "../../plugin/atoms/contributions.ts"
import { fileContentOf } from "../atoms/read-file.ts"
import { fileEditOf } from "../atoms/file-edit.ts"
import { fileScrollOf } from "../atoms/file-scroll.ts"
import { shownLinesOf } from "../atoms/shown-lines.ts"
import { writeFileAtom } from "../atoms/write-file.ts"
import { noEdit, shownText, withRead, withTyped } from "../rules/file-edit.ts"
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
  const editAtom = fileEditOf(sessionId, workingFolder, path)
  const edit = useAtomValue(editAtom)
  const extensions = useAtomValue(editorExtensionsAtom)
  const write = useAtomSet(writeFileAtom)
  const save = (force = false) => write({ sessionId, workingFolder, path, force })

  const read = AsyncResult.isSuccess(result) && result.value.kind === "text" ? result.value : null
  useEffect(() => {
    if (read !== null) registry.set(editAtom, withRead(registry.get(editAtom), read))
  }, [read, registry, editAtom])
  useCommandHandler("file.save", () => save(), AsyncResult.isSuccess(result))

  if (AsyncResult.isInitial(result)) return <div className="iv-file-view" />
  const error = AsyncResult.isFailure(result) ? Cause.squash(result.cause) : null
  const deleted =
    edit.draft !== null &&
    errorTag(error) === "FileNotRead" &&
    (error as FileNotRead).reason === "missing"
  const reading = deleted
    ? { kind: "text" as const, text: edit.draft ?? "" }
    : AsyncResult.isSuccess(result)
      ? fileReading(result.value, path)
      : fileReadingFailure(error, path)

  if (reading.kind === "text") {
    const name = fileName(path)
    return (
      <div className="iv-file-view">
        {(edit.changedOnDisk || deleted) && (
          <div className="iv-file-view__changed" role="alert">
            <span className="iv-file-view__changed-icon">
              <Icon name="circle-alert" size={14} />
            </span>
            <span className="iv-file-view__changed-text">
              {name} {deleted ? "was deleted" : "changed"} on disk while you had unsaved edits.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                registry.set(editAtom, noEdit)
                retry()
              }}
            >
              Reload from disk
            </Button>
            <Button variant="secondary" size="sm" onClick={() => save(true)}>
              Overwrite
            </Button>
          </div>
        )}
        {edit.failure !== null && (
          <div className="iv-file-view__failure">
            <ErrorMessage
              message={edit.failure.text}
              {...(edit.failure.retryable && { onRetry: () => save() })}
            />
          </div>
        )}
        <CodeView
          text={shownText(edit) ?? reading.text}
          fileName={name}
          scrollTop={scrollTop}
          onScroll={(top) => registry.set(scroll, top)}
          onChange={(text) => registry.set(editAtom, withTyped(registry.get(editAtom), text))}
          extensions={extensions}
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
