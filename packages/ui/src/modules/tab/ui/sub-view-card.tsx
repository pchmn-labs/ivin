import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { SubView } from "@ivin/contracts/tab"
import { Exit } from "effect"
import { useContext, useId, useRef, useState, type KeyboardEvent } from "react"
import { Button, IconButton } from "../../../core/components/button/button.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { HarnessMark, type MarkName } from "../../../core/components/harness-mark/harness-mark.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Tooltip } from "../../../core/components/tooltip/tooltip.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { fileEditOf, unsavedPathsOf } from "../../file/atoms/file-edit.ts"
import { writeFileAtom } from "../../file/atoms/write-file.ts"
import { noEdit } from "../../file/rules/file-edit.ts"
import { fileName } from "../../file/rules/file-name.ts"
import { FileView } from "../../file/ui/file-view.tsx"
import { useKeyHint } from "../../keybinding/hooks/use-key-hint.ts"
import { closeSubViewAtom } from "../atoms/close-sub-view.ts"
import { subViewsOf } from "../atoms/list-sub-views.ts"
import { openSubViewAtom } from "../atoms/open-sub-view.ts"
import { selectSessionTabAtom } from "../atoms/select-session-tab.ts"
import { setFullWidthAtom } from "../atoms/set-full-width.ts"
import {
  closeFileFailure,
  selectSessionTabFailure,
  switchModeFailure,
} from "../rules/sub-view-failure.ts"
import { adjacentRowTab, sameSubView, subViewKey } from "../rules/sub-views.ts"
import "./sub-view-card.css"

const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.altKey || event.metaKey || event.ctrlKey) return
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
  const target = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: tabs.length - 1 }[
    event.key
  ]
  const next = target === undefined ? undefined : tabs[target]
  if (current < 0 || next === undefined || target === current) return
  event.preventDefault()
  next.focus()
  next.click()
}

const stopMiddleClickScroll = (event: { button: number; preventDefault: () => void }) => {
  if (event.button === 1) event.preventDefault()
}

interface Failure {
  readonly message: string
  readonly retry: () => void
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
  const close = useAtomSet(closeSubViewAtom, { mode: "promiseExit" })
  const setFullWidth = useAtomSet(setFullWidthAtom, { mode: "promiseExit" })
  const selectSessionTab = useAtomSet(selectSessionTabAtom, { mode: "promiseExit" })
  const [failure, setFailure] = useState<Failure | null>(null)
  const unsaved = useAtomValue(unsavedPathsOf(sessionId, workingFolder))
  // Kept once the prompt closes, so its text stays while it fades out.
  const [closing, setClosing] = useState<SubView | null>(null)
  const [confirming, setConfirming] = useState(false)
  const write = useAtomSet(writeFileAtom, { mode: "promise" })
  const registry = useContext(RegistryContext)
  const card = useRef<HTMLElement>(null)
  const cardId = useId()
  const fullWidthHint = useKeyHint("Full width", "tab.toggleFullWidth")
  const besideHint = useKeyHint("Beside chat", "tab.toggleFullWidth")

  const closeNow = async (subView: SubView) => {
    const hadFocus = card.current?.contains(document.activeElement) ?? false
    setFailure(null)
    const exit = await close({ sessionId, workingFolder, subView })
    if (Exit.isFailure(exit))
      return setFailure({
        message: closeFileFailure(subView.path),
        retry: () => void closeNow(subView),
      })
    registry.set(fileEditOf(sessionId, workingFolder, subView.path), noEdit)
    // The focused close button is gone with its tab.
    if (hadFocus)
      card.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
  }

  const closeFile = async (subView: SubView) => {
    if (!unsaved.includes(subView.path)) return closeNow(subView)
    setClosing(subView)
    setConfirming(true)
  }

  const saveAndClose = async (subView: SubView) => {
    setConfirming(false)
    if (await write({ sessionId, workingFolder, path: subView.path })) await closeNow(subView)
    // Its failure shows in its own view.
    else open({ sessionId, workingFolder, subView })
  }

  const switchMode = async (to: boolean) => {
    setFailure(null)
    const exit = await setFullWidth({ sessionId, workingFolder, fullWidth: to })
    if (Exit.isFailure(exit))
      setFailure({ message: switchModeFailure(to), retry: () => void switchMode(to) })
  }

  const showSession = async () => {
    setFailure(null)
    const exit = await selectSessionTab({ sessionId, workingFolder })
    if (Exit.isFailure(exit))
      setFailure({ message: selectSessionTabFailure, retry: () => void showSession() })
  }

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
      <div className="iv-sub-view-card__row">
        <div
          className="iv-sub-view-card__tabs"
          role="tablist"
          aria-label="Open files"
          onKeyDown={moveFocus}
        >
          {fullWidth && (
            <>
              <div
                className="iv-sub-view-card__item"
                role="presentation"
                data-selected={onSession || undefined}
              >
                <button
                  type="button"
                  role="tab"
                  className="iv-sub-view-card__tab iv-sub-view-card__tab--session"
                  aria-selected={onSession}
                  tabIndex={onSession ? 0 : -1}
                  onClick={() => void showSession()}
                >
                  <span className="iv-sub-view-card__icon" aria-hidden>
                    <HarnessMark mark={harnessMark} size={14} />
                  </span>
                  <span className="iv-sub-view-card__name">Session</span>
                </button>
              </div>
              <span className="iv-sub-view-card__separator" role="presentation" />
            </>
          )}
          {subViews.map((subView) => {
            const isSelected = !onSession && sameSubView(subView, selected)
            const isUnsaved = unsaved.includes(subView.path)
            const name = fileName(subView.path)
            const unsavedId = `${cardId}-${subViewKey(subView)}-unsaved`
            const closeThis = () => closeFile(subView)
            return (
              <div
                key={subViewKey(subView)}
                className="iv-sub-view-card__item"
                role="presentation"
                data-selected={isSelected || undefined}
                data-unsaved={isUnsaved || undefined}
                onMouseDown={stopMiddleClickScroll}
                onAuxClick={(event) => {
                  if (event.button !== 1) return
                  event.preventDefault()
                  void closeThis()
                }}
              >
                <button
                  type="button"
                  role="tab"
                  className="iv-sub-view-card__tab"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  title={subView.path}
                  aria-describedby={isUnsaved ? unsavedId : undefined}
                  onClick={() => open({ sessionId, workingFolder, subView })}
                >
                  <span className="iv-sub-view-card__icon" aria-hidden>
                    <Icon name="file" size={14} />
                  </span>
                  <span className="iv-sub-view-card__name">{name}</span>
                </button>
                {isUnsaved && (
                  <span id={unsavedId} className="iv-visually-hidden">
                    Unsaved edits
                  </span>
                )}
                <button
                  type="button"
                  className="iv-sub-view-card__close"
                  aria-label={`Close ${name}`}
                  onClick={() => void closeThis()}
                >
                  <span className="iv-sub-view-card__unsaved" aria-hidden />
                  <Icon name="x" size={12} />
                </button>
              </div>
            )
          })}
        </div>
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
          aria-label={fileName(selected.path)}
        >
          <FileView
            key={subViewKey(selected)}
            sessionId={sessionId}
            workingFolder={workingFolder}
            path={selected.path}
          />
        </div>
      )}
    </section>
  )
}
