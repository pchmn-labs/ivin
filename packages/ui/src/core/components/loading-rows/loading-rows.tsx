import "./loading-rows.css"

const ROWS = ["wide", "short", "wide", "short"]

// With a `label` the rows are announced; without one the caller's own element says it is busy.
export function LoadingRows({ label }: { label?: string }) {
  return (
    <div
      className="iv-loading-rows"
      {...(label === undefined ? { "aria-hidden": true } : { role: "status", "aria-label": label })}
    >
      {ROWS.map((width, i) => (
        <div key={i} className="iv-loading-rows__row">
          <span className="iv-loading-rows__row-mark" />
          <span className="iv-loading-rows__row-lines">
            <span className="iv-loading-rows__row-line" data-width={width} />
            <span className="iv-loading-rows__row-line" data-width="short" />
          </span>
        </div>
      ))}
    </div>
  )
}
