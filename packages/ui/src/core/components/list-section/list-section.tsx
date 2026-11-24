import type { ListSectionProps } from "@ivin/plugin-api/ui"
import "./list-section.css"

export type { ListSectionProps }

const PLACEHOLDER_ROWS = ["wide", "short", "wide", "short"]

export function ListSection({
  label,
  count,
  attention = false,
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
      <h2 className="iv-list-section__label" data-attention={attention || undefined}>
        {label}
        {count === undefined ? null : <span className="iv-list-section__count">{count}</span>}
      </h2>
      {loading ? (
        <div className="iv-list-section__placeholders" aria-hidden>
          {PLACEHOLDER_ROWS.map((width, i) => (
            <div key={i} className="iv-list-section__placeholder">
              <span className="iv-list-section__placeholder-mark" />
              <span className="iv-list-section__placeholder-lines">
                <span className="iv-list-section__placeholder-line" data-width={width} />
                <span className="iv-list-section__placeholder-line" data-width="short" />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <ul className="iv-list-section__rows">{children}</ul>
      )}
    </section>
  )
}
