import type { ReactNode, Ref } from "react"
import { Icon } from "../icon/icon.tsx"
import { ResizeHandle } from "../resize-handle/resize-handle.tsx"
import "../../../modules/tab/ui/sub-view-card.css"
import "./sheet-frame.css"

// A raised panel docked on the composer: a row of tabs with an aside and a close button, then its body.
export function SheetFrame({
  ref,
  className,
  testId,
  label,
  resizeLabel,
  resizeName,
  tabs,
  aside,
  closeLabel,
  onClose,
  children,
}: {
  ref?: Ref<HTMLDivElement>
  className?: string
  testId?: string
  label: string
  resizeLabel: string
  resizeName: string
  tabs: ReactNode
  aside?: ReactNode
  closeLabel: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className={className === undefined ? "iv-sheet" : `iv-sheet ${className}`}
      ref={ref}
      data-testid={testId}
      role="region"
      aria-label={label}
      data-view-frame="sheet"
    >
      <ResizeHandle
        label={resizeLabel}
        edge="top"
        property="--iv-task-sheet-height"
        name={resizeName}
        min={160}
        max={(element) => (element.parentElement?.getBoundingClientRect().top ?? 400) - 48}
      />
      <div className="iv-sub-view-card__row iv-sheet__row">
        {tabs}
        {aside}
        <button
          type="button"
          className="iv-sub-view-card__close iv-sheet__close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
      <div className="iv-sheet__body">{children}</div>
    </div>
  )
}
