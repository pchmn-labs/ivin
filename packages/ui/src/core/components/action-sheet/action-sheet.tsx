import type { ActionSheetProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import "./action-sheet.css"

export type { ActionSheetProps }

const INTERACTIVE = "button, a, input, textarea, select, [tabindex]"
const TABBABLE = 'button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]'

export function ActionSheet({
  tone = "neutral",
  icon,
  title,
  detail,
  hint,
  children,
  "data-testid": testId,
}: ActionSheetProps) {
  return (
    <div
      className="iv-action-sheet"
      data-tone={tone}
      role="group"
      aria-label={title}
      data-testid={testId}
      onMouseDown={(event) => {
        if (!(event.target instanceof Element) || event.target.closest(INTERACTIVE) !== null) return
        const control = event.currentTarget.querySelector<HTMLElement>(TABBABLE)
        if (control === null) return
        event.preventDefault()
        control.focus()
      }}
    >
      <div className="iv-action-sheet__head">
        {icon === undefined ? null : <Icon name={icon} size={16} />}
        <span className="iv-action-sheet__title">{title}</span>
        {detail === undefined ? null : (
          <span className="iv-action-sheet__detail" title={detail}>
            {detail}
          </span>
        )}
      </div>
      {children}
      {hint === undefined ? null : <p className="iv-action-sheet__hint">{hint}</p>}
    </div>
  )
}
