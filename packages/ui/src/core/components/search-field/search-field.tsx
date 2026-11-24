import type { SearchFieldProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import "./search-field.css"

export type { SearchFieldProps }

export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  onBlur,
  onEscape,
}: SearchFieldProps) {
  return (
    <label className="iv-search-field">
      <Icon name="search" size={12} />
      <input
        className="iv-search-field__input"
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || event.nativeEvent.isComposing) return
          // Kept from the window's keybindings, where Escape stops the agent.
          event.preventDefault()
          if (value !== "") onChange("")
          else onEscape?.()
        }}
      />
    </label>
  )
}
