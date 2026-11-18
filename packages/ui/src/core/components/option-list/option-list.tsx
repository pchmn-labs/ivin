import { useEffect, useRef } from "react"
import type { OptionListProps } from "@ivin/plugin-api/ui"
import "./option-list.css"

export type { OptionListProps }

export function OptionList({
  label,
  options,
  value,
  onChange,
  onSubmit,
  onEscape,
  submitOnClick = false,
  disabled = false,
  keyboardSource,
}: OptionListProps) {
  const root = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (disabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      const target = event.target
      const inList = target instanceof Node && root.current?.contains(target) === true
      if (!inList && keyboardSource?.(target) !== true) return

      const index = options.findIndex((option) => option.id === value)
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const next =
          options[
            Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))
          ]
        if (next === undefined) return
        onChange(next.id)
        if (inList) buttons.current.get(next.id)?.focus()
      } else if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        onSubmit(value)
      } else if (event.key === "Escape" && onEscape !== undefined) {
        event.preventDefault()
        onEscape()
      }
    }
    // Capture phase: runs before a field's own handler can empty itself and change who drives the list.
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [disabled, options, value, onChange, onSubmit, onEscape, keyboardSource])

  return (
    <div className="iv-option-list" role="radiogroup" aria-label={label} ref={root}>
      {options.map((option) => (
        <button
          key={option.id}
          ref={(node) => {
            if (node) buttons.current.set(option.id, node)
            else buttons.current.delete(option.id)
          }}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          tabIndex={option.id === value ? 0 : -1}
          disabled={disabled}
          className="iv-option-list__option"
          onKeyDown={(event) => {
            if (event.key !== " ") return
            event.preventDefault()
            onChange(option.id)
          }}
          onClick={() => {
            onChange(option.id)
            if (submitOnClick) onSubmit(option.id)
          }}
        >
          <span className="iv-option-list__label">{option.label}</span>
          {option.hint === undefined ? null : (
            <kbd className="iv-option-list__hint">{option.hint}</kbd>
          )}
        </button>
      ))}
    </div>
  )
}
