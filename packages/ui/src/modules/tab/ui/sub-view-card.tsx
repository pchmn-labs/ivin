import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Suspense, lazy, useRef } from "react"
import { Button, IconButton } from "../../../core/components/button/button.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import type { MarkName } from "../../../core/components/harness-mark/harness-mark.tsx"
import { ResizeHandle } from "../../../core/components/resize-handle/resize-handle.tsx"
import { Tooltip } from "../../../core/components/tooltip/tooltip.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { fileName } from "../../file/rules/file-name.ts"
import { useKeyHint } from "../../keybinding/hooks/use-key-hint.ts"
import { subViewsOf } from "../atoms/list-sub-views.ts"
import { openSubViewAtom } from "../atoms/open-sub-view.ts"
import { useSubViewActions } from "../hooks/use-sub-view-actions.ts"
import { adjacentRowTab, subViewKey } from "../rules/sub-views.ts"
import { SubViewTabs } from "./sub-view-tabs.tsx"
import { LoadingRows } from "../../../core/components/loading-rows/loading-rows.tsx"
import "./sub-view-card.css"

// CodeMirror comes with these two views, so the window does not load it before one opens.
const DiffView = lazy(() =>
  import("../../file/ui/diff-view.tsx").then((m) => ({ default: m.DiffView })),
)
const FileView = lazy(() =>
  import("../../file/ui/file-view.tsx").then((m) => ({ default: m.FileView })),
)

const CARD_MIN = 280

const cardMax = (card: HTMLElement) => {
  const split = card.parentElement
  const chat = split?.querySelector(".iv-tab-view__session")
  if (split == null || chat == null) return CARD_MIN
  const chatMin = parseFloat(getComputedStyle(chat).minWidth)
  const margin = parseFloat(getComputedStyle(card).marginRight)
  return split.clientWidth - chatMin - margin
}

export function SubViewCard({
  sessionId,
  workingFolder,
  harnessMark,
}: {
  sessionId: string
  workingFolder: string
  harnessMark: MarkName
}) {
  const state = useAtomValue(subViewsOf(sessionId, workingFolder).value)
  const { subViews, selected, fullWidth } = state
  const onSession = fullWidth && state.sessionTabSelected
  const open = useAtomSet(openSubViewAtom)
  const card = useRef<HTMLElement>(null)
  const {
    failure,
    closing,
    confirming,
    setConfirming,
    isUnsaved,
    closeFile,
    closeNow,
    saveAndClose,
    switchMode,
    showSession,
  } = useSubViewActions(sessionId, workingFolder, card)
  const fullWidthHint = useKeyHint("Full width", "tab.toggleFullWidth")
  const besideHint = useKeyHint("Beside chat", "tab.toggleFullWidth")

  const selectAdjacent = (step: 1 | -1) => {
    const next = adjacentRowTab(state, step)
    if (next === "session") void showSession()
    else if (next !== null) open({ sessionId, workingFolder, subView: next })
  }

  const hasFiles = selected !== null
  useCommandHandler(
    "tab.closeFile",
    () => selected && void closeFile(selected),
    hasFiles && !onSession,
  )
  useCommandHandler("tab.toggleFullWidth", () => void switchMode(!fullWidth), hasFiles)
  useCommandHandler("tab.nextCardTab", () => selectAdjacent(1), hasFiles)
  useCommandHandler("tab.previousCardTab", () => selectAdjacent(-1), hasFiles)

  if (selected === null) return null

  return (
    <section
      ref={card}
      className="iv-sub-view-card"
      aria-label="Open files"
      data-on-session={onSession || undefined}
    >
      {!fullWidth && (
        <ResizeHandle
          label="Resize the files card"
          edge="left"
          property="--iv-sub-view-card-width"
          name="sub-view-card"
          min={CARD_MIN}
          max={cardMax}
        />
      )}
      <div className="iv-sub-view-card__row">
        <SubViewTabs
          sessionId={sessionId}
          workingFolder={workingFolder}
          subViews={subViews}
          selected={selected}
          fullWidth={fullWidth}
          onSession={onSession}
          harnessMark={harnessMark}
          isUnsaved={isUnsaved}
          closeFile={closeFile}
          showSession={showSession}
        />
        {fullWidth ? (
          <Tooltip content={besideHint}>
            <Button variant="ghost" size="sm" icon="split" onClick={() => void switchMode(false)}>
              Beside chat
            </Button>
          </Tooltip>
        ) : (
          <IconButton
            icon="arrows-out"
            label="Full width"
            tooltip={fullWidthHint}
            size="sm"
            onClick={() => void switchMode(true)}
          />
        )}
      </div>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Close ${fileName(closing?.path ?? "")} without saving?`}
        description="Your edits to it are lost unless you save them."
        actions={
          closing && (
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirming(false)
                  void closeNow(closing)
                }}
              >
                Close without saving
              </Button>
              <Button variant="primary" onClick={() => void saveAndClose(closing)}>
                Save
              </Button>
            </>
          )
        }
      />
      {failure !== null && (
        <div className="iv-sub-view-card__failure">
          <ErrorMessage message={failure.message} onRetry={failure.retry} />
        </div>
      )}
      {!onSession && (
        <div
          className="iv-sub-view-card__body"
          role="tabpanel"
          aria-label={
            selected.kind !== "file"
              ? `Diff of ${fileName(selected.path)}`
              : fileName(selected.path)
          }
        >
          <Suspense fallback={<LoadingRows label="Loading" />}>
            {selected.kind !== "file" ? (
              <DiffView
                key={subViewKey(selected)}
                kind={selected.kind}
                sessionId={sessionId}
                workingFolder={workingFolder}
                path={selected.path}
                onOpenFile={() =>
                  open({ sessionId, workingFolder, subView: { kind: "file", path: selected.path } })
                }
              />
            ) : (
              <FileView
                key={subViewKey(selected)}
                sessionId={sessionId}
                workingFolder={workingFolder}
                path={selected.path}
              />
            )}
          </Suspense>
        </div>
      )}
    </section>
  )
}
