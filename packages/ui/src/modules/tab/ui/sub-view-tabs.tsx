import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { SubView } from "@ivin/contracts/tab"
import { useId, type KeyboardEvent } from "react"
import { HarnessMark, type MarkName } from "../../../core/components/harness-mark/harness-mark.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { fileName } from "../../file/rules/file-name.ts"
import { fileIconsAtom } from "../../plugin/atoms/contributions.ts"
import { fileIconOf } from "../../plugin/rules/file-icon.ts"
import { openSubViewAtom } from "../atoms/open-sub-view.ts"
import { sameSubView, subViewKey } from "../rules/sub-views.ts"

const DIFF_LABELS = { diff: "diff", committed_diff: "committed" } as const

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

export function SubViewTabs({
  sessionId,
  workingFolder,
  subViews,
  selected,
  fullWidth,
  onSession,
  harnessMark,
  isUnsaved,
  closeFile,
  showSession,
}: {
  sessionId: string
  workingFolder: string
  subViews: ReadonlyArray<SubView>
  selected: SubView
  fullWidth: boolean
  onSession: boolean
  harnessMark: MarkName
  isUnsaved: (subView: SubView) => boolean
  closeFile: (subView: SubView) => Promise<void>
  showSession: () => Promise<void>
}) {
  const open = useAtomSet(openSubViewAtom)
  const cardId = useId()
  const fileIcons = useAtomValue(fileIconsAtom)
  return (
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
        const unsavedEdits = isUnsaved(subView)
        const name = fileName(subView.path)
        const isDiff = subView.kind !== "file"
        const unsavedId = `${cardId}-${subViewKey(subView)}-unsaved`
        const closeThis = () => closeFile(subView)
        return (
          <div
            key={subViewKey(subView)}
            className="iv-sub-view-card__item"
            role="presentation"
            data-selected={isSelected || undefined}
            data-unsaved={unsavedEdits || undefined}
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
              aria-describedby={unsavedEdits ? unsavedId : undefined}
              onClick={() => open({ sessionId, workingFolder, subView })}
            >
              <span className="iv-sub-view-card__icon" aria-hidden>
                {fileIconOf(fileIcons, { name, folder: false, open: false }) ?? (
                  <Icon name={isDiff ? "diff" : "file"} size={14} />
                )}
              </span>
              <span className="iv-sub-view-card__name">{name}</span>
              {isDiff && (
                <>
                  {" "}
                  <span className="iv-sub-view-card__kind">{DIFF_LABELS[subView.kind]}</span>
                </>
              )}
            </button>
            {unsavedEdits && (
              <span id={unsavedId} className="iv-visually-hidden">
                Unsaved edits
              </span>
            )}
            <button
              type="button"
              className="iv-sub-view-card__close"
              aria-label={`Close ${isDiff ? `the ${subView.kind === "diff" ? "" : "committed "}diff of ${name}` : name}`}
              onClick={() => void closeThis()}
            >
              <span className="iv-sub-view-card__unsaved" aria-hidden />
              <Icon name="x" size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
