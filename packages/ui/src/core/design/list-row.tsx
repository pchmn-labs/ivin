import type { ReactNode } from "react"
import "./list-row.css"

export interface ListRowProps {
  readonly leading?: ReactNode
  readonly title: ReactNode
  readonly meta?: ReactNode
  readonly selected?: boolean
  readonly onSelect?: () => void
  readonly actions?: ReactNode
  readonly "aria-current"?: "page" | "true" | boolean
  readonly "data-testid"?: string
}

export function ListRow({
  leading,
  title,
  meta,
  selected = false,
  onSelect,
  actions,
  "aria-current": ariaCurrent,
  "data-testid": testId,
}: ListRowProps) {
  return (
    <div className="iv-list-row" data-selected={selected || undefined} data-testid={testId}>
      <button
        type="button"
        className="iv-list-row__main"
        onClick={onSelect}
        aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
      >
        {leading === undefined ? null : <span className="iv-list-row__leading">{leading}</span>}
        <span className="iv-list-row__title">{title}</span>
        {meta === undefined ? null : <span className="iv-list-row__meta">{meta}</span>}
      </button>
      {actions === undefined ? null : <div className="iv-list-row__actions">{actions}</div>}
    </div>
  )
}
