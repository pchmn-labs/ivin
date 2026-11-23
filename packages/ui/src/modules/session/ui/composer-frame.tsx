import type { ComposerFrameProps } from "@ivin/plugin-api/ui"
import "./composer-frame.css"

export function ComposerFrame({
  area,
  alert,
  sheets,
  location,
  status,
  announce,
  children,
}: ComposerFrameProps) {
  return (
    <div className="iv-composer" data-keybinding-area={area}>
      {alert === undefined || alert === null || alert === false ? null : (
        <div className="iv-composer__alert" data-testid="composer-alert">
          {alert}
        </div>
      )}
      {sheets === undefined ? null : <div className="iv-composer__sheets">{sheets}</div>}
      {children}
      {announce === undefined ? null : (
        <span className="iv-visually-hidden" role="status" data-testid="composer-session-status">
          {announce}
        </span>
      )}
      <div className="iv-composer__statusline">
        {location}
        <div className="iv-composer__status-slot" data-testid="composer-status">
          {status}
        </div>
      </div>
    </div>
  )
}
