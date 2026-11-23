import { ErrorMessage, type ErrorMessageProps } from "../error-message/error-message.tsx"
import "./failure-state.css"

export function FailureHeader(props: ErrorMessageProps) {
  return (
    <div className="iv-failure__row">
      <ErrorMessage {...props} />
    </div>
  )
}

export function FailureSkeleton() {
  return (
    <div className="iv-failure__skeleton" aria-hidden>
      {["wide", "full", "short", "wide", "short"].map((width, i) => (
        <span key={i} className="iv-failure__ghost" data-width={width} />
      ))}
    </div>
  )
}
