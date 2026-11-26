import type { PillProps } from "@ivin/plugin-api/ui"
import { BoldGlyph } from "../icon/bold-glyph.tsx"
import { Icon } from "../icon/icon.tsx"
import "../../theme/tones.css"
import "./pill.css"

export type { PillProps }

function Status({ status }: { status: NonNullable<PillProps["status"]> }) {
  if (status === "running") return <span className="iv-pill__spinner" />
  return (
    <span className="iv-pill__disc">
      <BoldGlyph name={status === "passed" ? "check" : "x"} size={7} />
    </span>
  )
}

export function Pill({ tone, icon, status, children }: PillProps) {
  return (
    <span className="iv-pill" data-tone={tone}>
      {status !== undefined ? (
        <Status status={status} />
      ) : icon === undefined ? null : (
        <Icon name={icon} size={12} />
      )}
      {children}
    </span>
  )
}
