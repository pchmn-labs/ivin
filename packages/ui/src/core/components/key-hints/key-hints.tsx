import type { IconName, KeyHintsProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import "./key-hints.css"

export type { KeyHintsProps }

const keyIcons: Readonly<Record<string, { readonly icon: IconName; readonly label: string }>> = {
  "↵": { icon: "enter", label: "Enter" },
  "↑": { icon: "arrow-up", label: "Up arrow" },
  "↓": { icon: "arrow-down", label: "Down arrow" },
  "←": { icon: "arrow-left", label: "Left arrow" },
  "→": { icon: "arrow-right", label: "Right arrow" },
  "↑↓": { icon: "arrows-down-up", label: "Up and down arrows" },
  "←→": { icon: "arrows-left-right", label: "Left and right arrows" },
}

function Key({ name }: { readonly name: string }) {
  const known = keyIcons[name]
  return (
    <kbd>
      {known === undefined ? name : <Icon name={known.icon} size={12} label={known.label} />}
    </kbd>
  )
}

export function KeyHints({ hints }: KeyHintsProps) {
  return (
    <span className="iv-key-hints">
      {hints.map(({ key, label }) => (
        <span key={`${key} ${label}`} className="iv-key-hints__hint">
          {key.split(" ").map((name) => (
            <Key key={name} name={name} />
          ))}
          <span>{label}</span>
        </span>
      ))}
    </span>
  )
}
