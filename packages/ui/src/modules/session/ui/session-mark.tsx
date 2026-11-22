import type { SessionMarkProps } from "@ivin/plugin-api/ui"
import { HarnessMark } from "../../../core/components/harness-mark/harness-mark.tsx"
import { HARNESSES } from "../rules/harnesses.ts"
import { statusLabel } from "../rules/status-label.ts"
import "./session-mark.css"

export function SessionMark({ status, harness }: SessionMarkProps) {
  return (
    <span className="iv-session-mark" data-status={status}>
      <HarnessMark mark={HARNESSES[harness].mark} />
      <span className="iv-session-mark__overlay" aria-hidden="true">
        {status === "waiting" && (
          <svg viewBox="0 0 12 12">
            <path
              fillRule="evenodd"
              fill="currentColor"
              d="M0 6a6 6 0 1 0 12 0a6 6 0 1 0-12 0ZM5.2 3.1a.8.8 0 0 1 1.6 0v3.6a.8.8 0 0 1-1.6 0ZM5.05 8.9a.95.95 0 1 0 1.9 0a.95.95 0 1 0-1.9 0Z"
            />
          </svg>
        )}
      </span>
      <span className="iv-visually-hidden">{statusLabel(status)}</span>
    </span>
  )
}
