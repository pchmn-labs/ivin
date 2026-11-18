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
}: OptionListProps) {
  const root = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (disabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      const target = event.target
      // The composer keeps focus while a sheet is open, so its empty textarea drives the list too.
      const driven =
        (target instanceof Node && root.current?.contains(target)) ||
        (target instanceof HTMLTextAreaElement && target.value === "") ||
        target === document.body
      if (!driven) return

      const index = options.findIndex((option) => option.id === value)
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const next =
          options[
            Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))
          ]
        if (next === undefined) return
        onChange(next.id)
        if (target instanceof Node && root.current?.contains(target))
          buttons.current.get(next.id)?.focus()
      } else if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        onSubmit(value)
      } else if (event.key === "Escape" && onEscape !== undefined) {
        event.preventDefault()
        onEscape()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [disabled, options, value, onChange, onSubmit, onEscape])

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
