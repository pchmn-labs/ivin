import type { ReactNode } from "react"
import type { ListRowProps } from "@ivin/plugin-api/ui"
import { Tooltip } from "../tooltip/tooltip.tsx"
import "./list-row.css"

export type { ListRowProps }

export function ListRow({
  href,
  leading,
  title,
  subtitle,
  meta,
  subtitleMeta,
  selected = false,
  attention = false,
  onSelect,
  actions,
  below,
  tooltip,
  "aria-current": ariaCurrent,
  "data-testid": testId,
}: ListRowProps) {
  const metaSpan = (node: ReactNode) =>
    node === undefined ? null : <span className="iv-list-row__meta">{node}</span>
  const content = (
    <>
      {leading === undefined ? null : <span className="iv-list-row__leading">{leading}</span>}
      {subtitle === undefined ? (
        <>
          <span className="iv-list-row__title">{title}</span>
          {metaSpan(subtitleMeta)}
          {metaSpan(meta)}
        </>
      ) : subtitleMeta === undefined ? (
        <>
          <span className="iv-list-row__text">
            <span className="iv-list-row__title">{title}</span>
            <span className="iv-list-row__subtitle">{subtitle}</span>
          </span>
          {metaSpan(meta)}
        </>
      ) : (
        <span className="iv-list-row__text">
          <span className="iv-list-row__text-line">
            <span className="iv-list-row__title">{title}</span>
            {metaSpan(meta)}
          </span>
          <span className="iv-list-row__text-line">
            <span className="iv-list-row__subtitle">{subtitle}</span>
            {metaSpan(subtitleMeta)}
          </span>
        </span>
      )}
    </>
  )
  const row = (
    <div
      className="iv-list-row"
      data-selected={selected || undefined}
      data-attention={attention || undefined}
      data-testid={testId}
    >
      <div className="iv-list-row__line">
        {href === undefined ? (
          <button
            type="button"
            className="iv-list-row__main"
            onClick={onSelect}
            aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
          >
            {content}
          </button>
        ) : (
          <a
            className="iv-list-row__main iv-list-row__main--link"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {content}
          </a>
        )}
        {actions === undefined ? null : <div className="iv-list-row__actions">{actions}</div>}
      </div>
      {below === undefined ? null : <div className="iv-list-row__below">{below}</div>}
    </div>
  )
  if (tooltip === undefined) return row
  return (
    <Tooltip
      content={tooltip.text}
      {...(tooltip.label !== undefined && { label: tooltip.label })}
      mono={tooltip.mono ?? false}
      side="right"
    >
      {row}
    </Tooltip>
  )
}
