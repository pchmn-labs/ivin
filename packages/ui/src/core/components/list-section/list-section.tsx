import type { ListSectionProps } from "@ivin/plugin-api/ui"
import "./list-section.css"

export type { ListSectionProps }

export function ListSection({
  label,
  count,
  attention = false,
  "data-testid": testId,
  children,
}: ListSectionProps) {
  return (
    <section className="iv-list-section" aria-label={label} data-testid={testId}>
      <h2 className="iv-list-section__label" data-attention={attention || undefined}>
        {label}
        {count === undefined ? null : <span className="iv-list-section__count">{count}</span>}
      </h2>
      <ul className="iv-list-section__rows">{children}</ul>
    </section>
  )
}
