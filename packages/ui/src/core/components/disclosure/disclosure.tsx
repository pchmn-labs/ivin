import type { DisclosureProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import "./disclosure.css"

export type { DisclosureProps }

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  variant = "default",
  "data-testid": testId,
}: DisclosureProps) {
  return (
    <details
      className={
        variant === "default" ? "iv-disclosure" : `iv-disclosure iv-disclosure--${variant}`
      }
      open={defaultOpen}
      data-testid={testId}
    >
      <summary
        className="iv-disclosure__summary"
        // Chromium shows the focus ring on a clicked summary; only the keyboard should focus it.
        onMouseDown={(event) => event.preventDefault()}
      >
        <span className="iv-disclosure__chevron">
          <Icon name="chevron-right" size={12} />
        </span>
        {summary}
      </summary>
      <div className="iv-disclosure__body">{children}</div>
    </details>
  )
}
