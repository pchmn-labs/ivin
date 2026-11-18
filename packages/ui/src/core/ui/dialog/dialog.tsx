import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import type { DialogProps } from "@ivin/plugin-api/ui"
import "./dialog.css"

export type { DialogProps }

export function Dialog({ open, onOpenChange, title, description, children, actions }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="iv-dialog__backdrop" />
        <BaseDialog.Popup className="iv-dialog">
          <BaseDialog.Title className="iv-dialog__title">{title}</BaseDialog.Title>
          {description === undefined ? null : (
            <BaseDialog.Description className="iv-dialog__description">
              {description}
            </BaseDialog.Description>
          )}
          {children === undefined ? null : <div className="iv-dialog__body">{children}</div>}
          {actions === undefined ? null : <div className="iv-dialog__actions">{actions}</div>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
