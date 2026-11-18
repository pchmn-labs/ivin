import type { StatusMarkProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import "./status-mark.css"

export type { StatusMarkProps }

export function StatusMark({ status, label, showLabel = false }: StatusMarkProps) {
  return (
    <span className="iv-status-mark" data-status={status}>
      {status === "failed" ? (
        <Icon name="circle-alert" size={12} />
      ) : (
        <span className="iv-status-mark__dot" aria-hidden="true" />
      )}
      <span className={showLabel ? "iv-status-mark__label" : "iv-visually-hidden"}>{label}</span>
    </span>
  )
}
