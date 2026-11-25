import { useAtom } from "@effect/atom-react"
import { sameSubView, subViewKey, type SubView } from "@ivin/contracts/tab"
import { SheetFrame } from "../../../core/components/sheet-frame/sheet-frame.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { ContextMenu } from "../../../core/components/menu/menu.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { sheetViewsOf } from "../atoms/overlay-views.ts"
import { withSheetViewClosed, withSheetViewOpen } from "../rules/overlay-views.ts"
import { useMoveTo } from "../hooks/use-move-to.ts"
import { useViewLook } from "../hooks/use-view-look.tsx"
import { ViewBody } from "./view-body.tsx"

function SheetTab({
  sessionId,
  workingFolder,
  view,
  selected,
  onSelect,
  onClose,
}: {
  sessionId: string
  workingFolder: string
  view: SubView
  selected: boolean
  onSelect: () => void
  onClose: () => void
}) {
  const { title, icon } = useViewLook(view)
  const moveTo = useMoveTo(sessionId, workingFolder, view, "sheet")
  return (
    <ContextMenu
      items={[
        ...moveTo,
        ...(moveTo.length > 0 ? ["separator" as const] : []),
        { label: "Close", icon: "x", onSelect: onClose },
      ]}
    >
      <div
        className="iv-sub-view-card__item"
        role="presentation"
        data-selected={selected || undefined}
      >
        <button
          type="button"
          role="tab"
          className="iv-sub-view-card__tab"
          aria-selected={selected}
          data-view-tab={subViewKey(view)}
          onClick={onSelect}
        >
          <span className="iv-sub-view-card__icon" aria-hidden>
            {icon}
          </span>
          <span className="iv-sub-view-card__name">{title}</span>
        </button>
        <button
          type="button"
          className="iv-sub-view-card__close"
          tabIndex={-1}
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
    </ContextMenu>
  )
}

// A view's tab row and body, docked on the composer; one tab per open sheet view of the session.
export function ViewSheet({
  sessionId,
  workingFolder,
}: {
  sessionId: string
  workingFolder: string
}) {
  const [state, setState] = useAtom(sheetViewsOf(sessionId, workingFolder))
  const { views, selected } = state
  const close = (view: SubView) => setState((current) => withSheetViewClosed(current, view))
  // The last handler registered wins, so Escape closes the sheet before it interrupts the agent.
  useCommandHandler("session.interrupt", () => selected && close(selected), selected !== null)
  if (selected === null) return null
  return (
    <SheetFrame
      testId="view-sheet"
      label="Views"
      resizeLabel="Resize the view sheet"
      resizeName="view-sheet"
      closeLabel="Close the view"
      onClose={() => close(selected)}
      tabs={
        <div className="iv-sub-view-card__tabs" role="tablist" aria-label="Open views">
          {views.map((view) => (
            <SheetTab
              key={subViewKey(view)}
              sessionId={sessionId}
              workingFolder={workingFolder}
              view={view}
              selected={sameSubView(view, selected)}
              onSelect={() => setState((current) => withSheetViewOpen(current, view))}
              onClose={() => close(view)}
            />
          ))}
        </div>
      }
    >
      <ViewBody
        key={subViewKey(selected)}
        sessionId={sessionId}
        view={selected}
        placement="sheet"
        close={() => close(selected)}
      />
    </SheetFrame>
  )
}
