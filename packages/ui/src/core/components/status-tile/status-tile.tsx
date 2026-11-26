import type { StatusTileProps } from "@ivin/plugin-api/ui"
import { BoldGlyph } from "../icon/bold-glyph.tsx"
import { Icon } from "../icon/icon.tsx"
import "../../theme/tones.css"
import "./status-tile.css"

export type { StatusTileProps }

const MARK_GLYPH = { check: "check", cross: "x", exclamation: "exclamation" } as const

export function StatusTile({ icon, tone, mark, pulse = false, label }: StatusTileProps) {
  return (
    <span
      className="iv-status-tile"
      role="img"
      aria-label={label}
      data-tone={tone}
      data-pulse={pulse || undefined}
    >
      <span className="iv-status-tile__icon">
        <Icon name={icon} size={14} />
      </span>
      {mark === undefined ? null : (
        <span className="iv-status-tile__mark" data-mark={mark}>
          <BoldGlyph name={MARK_GLYPH[mark]} size={mark === "exclamation" ? 6 : 5} />
        </span>
      )}
    </span>
  )
}
