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
            <circle cx="6" cy="6" r="6" fill="currentColor" />
            <path
              d="M6 3.1v3.6"
              className="iv-session-mark__glyph"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="6" cy="8.9" r=".95" className="iv-session-mark__glyph-fill" />
          </svg>
        )}
      </span>
      <span className="iv-visually-hidden">{statusLabel(status)}</span>
    </span>
  )
}
