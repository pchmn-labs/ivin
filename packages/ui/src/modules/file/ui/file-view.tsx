import { RegistryContext, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { FileNotRead } from "@ivin/contracts/file"
import { Cause } from "effect"
import { useContext, useEffect, useState, type ReactNode } from "react"
import { AsyncResult } from "effect/reactivity"
import { Button } from "../../../core/components/button/button.tsx"
import { CodeView } from "../../../core/components/code-view/code-view.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Segmented } from "../../../core/components/segmented/segmented.tsx"
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
import { desktopPlatform, showInFolder } from "../adapters/show-in-folder.ts"
import { isOutsidePath } from "../rules/file-link.ts"
import { fileName } from "../rules/file-name.ts"
import {
  byteSize,
  fileReading,
  fileReadingFailure,
  imageNotShown,
  isSvgPath,
  svgSource,
} from "../rules/file-reading.ts"
import { showInFolderLabel } from "../rules/show-in-folder.ts"
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
  const outside = isOutsidePath(path)
  const [svgShown, setSvgShown] = useState<SvgShown>("image")

  const read =
    !outside && AsyncResult.isSuccess(result) && result.value.kind === "text" ? result.value : null
  useEffect(() => {
    if (read !== null) registry.set(editAtom, withRead(registry.get(editAtom), read))
  }, [read, registry, editAtom])
  useCommandHandler("file.save", () => save(), AsyncResult.isSuccess(result) && !outside)

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

  const name = fileName(path)
  const outsideBar = outside && <OutsideBar path={path} />

  if (reading.kind === "image") {
    return (
      <div className="iv-file-view">
        {outsideBar}
        <ImageView key={reading.src} path={path} src={reading.src} bytes={reading.bytes} />
      </div>
    )
  }

  if (reading.kind === "text") {
    const text = shownText(edit) ?? reading.text
    const svg = isSvgPath(path)
    const switcher = svg && <SvgSwitch shown={svgShown} onChange={setSvgShown} />
    return (
      <div className="iv-file-view">
        {outsideBar}
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
        {svg && svgShown === "image" ? (
          <ImageView
            key={text}
            path={path}
            src={svgSource(text)}
            bytes={new TextEncoder().encode(text).length}
            controls={switcher}
          />
        ) : (
          <>
            {svg && <FileHead path={path}>{switcher}</FileHead>}
            <CodeView
              text={text}
              fileName={name}
              scrollTop={scrollTop}
              onScroll={(top) => registry.set(scroll, top)}
              {...(!outside && {
                onChange: (typed: string) =>
                  registry.set(editAtom, withTyped(registry.get(editAtom), typed)),
              })}
              extensions={extensions}
              {...(shownLines && { shownLines })}
            />
          </>
        )}
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

function OutsideBar({ path }: { path: string }) {
  const platform = desktopPlatform()
  return (
    <div className="iv-file-view__outside" role="status">
      <span className="iv-file-view__outside-icon">
        <Icon name="lock" size={14} />
      </span>
      <span className="iv-file-view__outside-text">
        {fileName(path)} is outside the working folder, so it cannot be edited.
      </span>
      {platform !== undefined && (
        <Button variant="ghost" size="sm" onClick={() => void showInFolder(path)}>
          {showInFolderLabel(platform)}
        </Button>
      )}
    </div>
  )
}

type SvgShown = "image" | "source"

function SvgSwitch({ shown, onChange }: { shown: SvgShown; onChange: (shown: SvgShown) => void }) {
  return (
    <Segmented
      label="Show the SVG as"
      value={shown}
      onChange={onChange}
      options={[
        { value: "image", label: "Image" },
        { value: "source", label: "Source" },
      ]}
    />
  )
}

function FileHead({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="iv-file-view__head">
      <span className="iv-file-view__path" title={path}>
        {path}
      </span>
      {children}
    </div>
  )
}

function ImageView({
  path,
  src,
  bytes,
  controls,
}: {
  path: string
  src: string
  bytes: number
  controls?: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  const [size, setSize] = useState<string | null>(null)
  const [actualSize, setActualSize] = useState(false)
  if (failed) {
    return (
      <div className="iv-file-view__message">
        <Text tone="muted">{imageNotShown(path)}</Text>
      </div>
    )
  }
  return (
    <>
      <FileHead path={path}>
        {size !== null && (
          <span className="iv-file-view__meta">
            {size} · {byteSize(bytes)}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={() => setActualSize(!actualSize)}>
          {actualSize ? "Fit" : "Actual size"}
        </Button>
        {controls}
      </FileHead>
      <div className="iv-file-view__stage" data-actual-size={actualSize || undefined}>
        <img
          className="iv-file-view__image"
          src={src}
          alt={fileName(path)}
          onLoad={(event) =>
            setSize(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)
          }
          onError={() => setFailed(true)}
        />
      </div>
    </>
  )
}
