import { useAtomSet } from "@effect/atom-react"
import type { SubView } from "@ivin/contracts/tab"
import { useId, type KeyboardEvent } from "react"
import { HarnessMark, type MarkName } from "../../../core/components/harness-mark/harness-mark.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { ContextMenu } from "../../../core/components/menu/menu.tsx"
import { useMoveTo } from "../../view/hooks/use-move-to.ts"
import { useViewLook } from "../../view/hooks/use-view-look.tsx"
import { openSubViewAtom } from "../atoms/open-sub-view.ts"
import { pathOf, sameSubView, subViewKey } from "../rules/sub-views.ts"

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

function SubViewTab({
  sessionId,
  workingFolder,
  subView,
  selected,
  unsaved,
  onOpen,
  onClose,
}: {
  sessionId: string
  workingFolder: string
  subView: SubView
  selected: boolean
  unsaved: boolean
  onOpen: () => void
  onClose: () => Promise<void>
}) {
  const unsavedId = `${useId()}-unsaved`
  const { title, icon } = useViewLook(subView)
  const moveTo = useMoveTo(sessionId, workingFolder, subView, "subView")
  return (
    <ContextMenu
      items={[
        ...moveTo,
        ...(moveTo.length > 0 ? ["separator" as const] : []),
        { label: "Close", icon: "x", onSelect: () => void onClose() },
      ]}
    >
      <div
        className="iv-sub-view-card__item"
        role="presentation"
        data-selected={selected || undefined}
        data-unsaved={unsaved || undefined}
        onMouseDown={stopMiddleClickScroll}
        onAuxClick={(event) => {
          if (event.button !== 1) return
          event.preventDefault()
          void onClose()
        }}
      >
        <button
          type="button"
          role="tab"
          className="iv-sub-view-card__tab"
          aria-selected={selected}
          tabIndex={selected ? 0 : -1}
          title={pathOf(subView) ?? title}
          aria-describedby={unsaved ? unsavedId : undefined}
          data-view-tab={subViewKey(subView)}
          onClick={onOpen}
        >
          <span className="iv-sub-view-card__icon" aria-hidden>
            {icon}
          </span>
          <span className="iv-sub-view-card__name">{title}</span>
        </button>
        {unsaved && (
          <span id={unsavedId} className="iv-visually-hidden">
            Unsaved edits
          </span>
        )}
        <button
          type="button"
          className="iv-sub-view-card__close"
          tabIndex={-1}
          aria-hidden
          aria-label={`Close ${title}`}
          onClick={() => void onClose()}
        >
          <span className="iv-sub-view-card__unsaved" aria-hidden />
          <Icon name="x" size={12} />
        </button>
      </div>
    </ContextMenu>
  )
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
          <span className="iv-sub-view-card__separator" aria-hidden />
        </>
      )}
      {subViews.map((subView) => (
        <SubViewTab
          key={subViewKey(subView)}
          sessionId={sessionId}
          workingFolder={workingFolder}
          subView={subView}
          selected={!onSession && sameSubView(subView, selected)}
          unsaved={isUnsaved(subView)}
          onOpen={() => open({ sessionId, workingFolder, subView })}
          onClose={() => closeFile(subView)}
        />
      ))}
    </div>
  )
}
