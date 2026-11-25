import { useAtom } from "@effect/atom-react"
import { Dialog } from "@base-ui/react/dialog"
import { subViewKey, type SubView } from "@ivin/contracts/tab"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Menu } from "../../../core/components/menu/menu.tsx"
import { dialogViewOf } from "../atoms/overlay-views.ts"
import { useMoveTo } from "../hooks/use-move-to.ts"
import { useViewLook } from "../hooks/use-view-look.tsx"
import { ViewBody } from "./view-body.tsx"
import "../../../core/components/dialog/dialog.css"
import "./view-dialog.css"

// One dialog at a time: opening another view replaces the one shown.
export function ViewDialog({
  sessionId,
  workingFolder,
}: {
  sessionId: string
  workingFolder: string
}) {
  const [view, setView] = useAtom(dialogViewOf(sessionId, workingFolder))
  if (view === null) return null
  return (
    <OpenViewDialog
      sessionId={sessionId}
      workingFolder={workingFolder}
      view={view}
      onClose={() => setView(null)}
    />
  )
}

function OpenViewDialog({
  sessionId,
  workingFolder,
  view,
  onClose,
}: {
  sessionId: string
  workingFolder: string
  view: SubView
  onClose: () => void
}) {
  const { title } = useViewLook(view)
  const moveTo = useMoveTo(sessionId, workingFolder, view, "dialog")
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="iv-dialog__backdrop" />
        <Dialog.Popup className="iv-dialog iv-view-dialog" data-view-frame="dialog">
          {moveTo.length === 0 ? (
            <Dialog.Title className="iv-dialog__title">{title}</Dialog.Title>
          ) : (
            <Dialog.Title className="iv-dialog__title" render={<div />}>
              <Menu
                items={moveTo}
                trigger={
                  <button
                    type="button"
                    className="iv-view-dialog__title-button"
                    data-view-tab={subViewKey(view)}
                  >
                    {title}
                    <Icon name="chevron-down" size={14} />
                  </button>
                }
              />
            </Dialog.Title>
          )}
          <div className="iv-view-dialog__body">
            <ViewBody
              key={subViewKey(view)}
              sessionId={sessionId}
              view={view}
              placement="dialog"
              close={onClose}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
