import type { DisclosureProps } from "@ivin/plugin-api/ui"
import { useState } from "react"
import { Icon } from "../icon/icon.tsx"
import "./disclosure.css"

export type { DisclosureProps }

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  variant = "default",
  actions,
  "data-testid": testId,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const details = (
    <details
      className={
        variant === "default" ? "iv-disclosure" : `iv-disclosure iv-disclosure--${variant}`
      }
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      data-testid={testId}
    >
      <summary
        className="iv-disclosure__summary"
        // Chromium shows the focus ring on a clicked summary; only the keyboard should focus it.
        onMouseDown={(event) => event.preventDefault()}
      >
        {variant !== "row" && (
          <span className="iv-disclosure__chevron">
            <Icon name="chevron-right" size={12} />
          </span>
        )}
        {summary}
      </summary>
      {open && <div className="iv-disclosure__body">{children}</div>}
    </details>
  )
  if (actions === undefined) return details
  // Outside the summary, so using them does not fold it, and outside the body, so they show while folded.
  return (
    <div className="iv-disclosure-frame" data-variant={variant}>
      {details}
      <div className="iv-disclosure-frame__actions">{actions}</div>
    </div>
  )
}
