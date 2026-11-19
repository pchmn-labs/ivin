import type { ListRowProps } from "@ivin/plugin-api/ui"
import "./list-row.css"

export type { ListRowProps }

export function ListRow({
  leading,
  title,
  subtitle,
  meta,
  selected = false,
  attention = false,
  onSelect,
  actions,
  "aria-current": ariaCurrent,
  "data-testid": testId,
}: ListRowProps) {
  return (
    <div
      className="iv-list-row"
      data-selected={selected || undefined}
      data-attention={attention || undefined}
      data-testid={testId}
    >
      <button
        type="button"
        className="iv-list-row__main"
        onClick={onSelect}
        aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
      >
        {leading === undefined ? null : <span className="iv-list-row__leading">{leading}</span>}
        {subtitle === undefined ? (
          <span className="iv-list-row__title">{title}</span>
        ) : (
          <span className="iv-list-row__text">
            <span className="iv-list-row__title">{title}</span>
            <span className="iv-list-row__subtitle">{subtitle}</span>
          </span>
        )}
        {meta === undefined ? null : <span className="iv-list-row__meta">{meta}</span>}
      </button>
      {actions === undefined ? null : <div className="iv-list-row__actions">{actions}</div>}
    </div>
  )
}
