import type { SessionStatus } from "@ivin/contracts/session"
import { ClaudeMark } from "../../../core/components/harness-mark/harness-mark.tsx"
import "./session-mark.css"

export function SessionMark({ status, label }: { status: SessionStatus; label: string }) {
  return (
    <span className="iv-session-mark" data-status={status}>
      <ClaudeMark />
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
      <span className="iv-visually-hidden">{label}</span>
    </span>
  )
}
