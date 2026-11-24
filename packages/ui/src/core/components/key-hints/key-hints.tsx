import type { KeyHintsProps } from "@ivin/plugin-api/ui"
import "./key-hints.css"

export type { KeyHintsProps }

export function KeyHints({ hints }: KeyHintsProps) {
  return (
    <span className="iv-key-hints">
      {hints.map(({ key, label }) => (
        <span key={`${key} ${label}`} className="iv-key-hints__hint">
          <kbd>{key}</kbd>
          <span>{label}</span>
        </span>
      ))}
    </span>
  )
}
