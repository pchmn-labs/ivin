import type { DisclosureProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import "./disclosure.css"

export type { DisclosureProps }

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  "data-testid": testId,
}: DisclosureProps) {
  return (
    <details className="iv-disclosure" open={defaultOpen} data-testid={testId}>
      <summary className="iv-disclosure__summary">
        <span className="iv-disclosure__chevron">
          <Icon name="chevron-right" size={12} />
        </span>
        {summary}
      </summary>
      <div className="iv-disclosure__body">{children}</div>
    </details>
  )
}
