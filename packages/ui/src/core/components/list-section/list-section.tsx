import type { ListSectionProps } from "@ivin/plugin-api/ui"
import { LoadingRows } from "../loading-rows/loading-rows.tsx"
import "./list-section.css"

export type { ListSectionProps }

export function ListSection({
  label,
  count,
  attention = false,
  hideLabel = false,
  loading = false,
  "data-testid": testId,
  children,
}: ListSectionProps) {
  return (
    <section
      className="iv-list-section"
      aria-label={label}
      aria-busy={loading || undefined}
      data-testid={testId}
    >
      <h2
        className={hideLabel ? "iv-visually-hidden" : "iv-list-section__label"}
        data-attention={attention || undefined}
      >
        {label}
        {count === undefined ? null : (
          <>
            {hideLabel ? " " : <span aria-hidden="true">·</span>}
            <span className="iv-list-section__count">{count}</span>
          </>
        )}
      </h2>
      {loading ? <LoadingRows /> : <ul className="iv-list-section__rows">{children}</ul>}
    </section>
  )
}
