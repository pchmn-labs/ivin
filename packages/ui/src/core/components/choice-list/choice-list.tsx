import { useEffect, useRef, useState } from "react"
import type { ChoiceListProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import { TextField } from "../text-field/text-field.tsx"
import "./choice-list.css"

export type { ChoiceListProps }

const isTextField = (element: Element | null) =>
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLInputElement ||
  (element instanceof HTMLElement && element.isContentEditable)

const toggled = (selected: ReadonlyArray<string>, id: string) =>
  selected.includes(id) ? selected.filter((each) => each !== id) : [...selected, id]

export function ChoiceList({
  label,
  multiple = false,
  options,
  selected,
  onSelectedChange,
  onSubmit,
  onEscape,
  onPrevious,
  onNext,
  other,
  disabled = false,
  keyboardSource,
  autoFocus = false,
}: ChoiceListProps) {
  const root = useRef<HTMLDivElement>(null)
  const rowElements = useRef(new Map<string, HTMLElement>())
  const rows = [...options.map((option) => option.id), ...(other ? [other.id] : [])]
  const [cursor, setCursor] = useState(() => selected[0] ?? rows[0] ?? "")
  const [editing, setEditing] = useState(false)
  const otherEmpty = other !== undefined && other.text.trim() === ""

  useEffect(() => {
    const active = document.activeElement
    if (!autoFocus || (isTextField(active) && keyboardSource?.(active) !== true)) return
    rowElements.current.get(cursor)?.focus()
    // Only on mount: a later render must not pull the focus back.
  }, [])

  const focusRow = (id: string) => rowElements.current.get(id)?.focus()

  const openOther = () => {
    if (other === undefined) return
    setCursor(other.id)
    if (!selected.includes(other.id))
      onSelectedChange(multiple ? [...selected, other.id] : [other.id])
    setEditing(true)
  }

  // `confirm`: a click or a number, which submits a single choice and edits Other's text.
  const pick = (id: string, confirm: boolean) => {
    setCursor(id)
    if (other !== undefined && id === other.id && (otherEmpty || confirm)) return openOther()
    const next = multiple ? toggled(selected, id) : [id]
    onSelectedChange(next)
    if (confirm && !multiple) onSubmit(next)
  }

  const submitCursor = () => {
    if (other !== undefined && cursor === other.id && otherEmpty) return openOther()
    const next = multiple ? (selected.length > 0 ? selected : [cursor]) : [cursor]
    if (next !== selected) onSelectedChange(next)
    onSubmit(next)
  }

  const closeOther = (moveTo: string) => {
    if (other === undefined) return
    setEditing(false)
    if (otherEmpty) onSelectedChange(selected.filter((id) => id !== other.id))
    setCursor(moveTo)
    focusRow(moveTo)
  }

  const step = (from: string, by: 1 | -1) =>
    rows[Math.max(0, Math.min(rows.length - 1, rows.indexOf(from) + by))] ?? from

  useEffect(() => {
    if (disabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      const target = event.target
      if (target instanceof Element && target.closest(".iv-choice-list__field") !== null) return
      const inList = target instanceof Node && root.current?.contains(target) === true
      if (!inList && keyboardSource?.(target) !== true) return

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const next = step(cursor, event.key === "ArrowDown" ? 1 : -1)
        setCursor(next)
        if (inList) focusRow(next)
      } else if (event.key === "ArrowLeft" && onPrevious !== undefined) {
        event.preventDefault()
        onPrevious()
      } else if (event.key === "ArrowRight" && onNext !== undefined) {
        event.preventDefault()
        onNext()
      } else if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        submitCursor()
      } else if (event.key === "Escape" && onEscape !== undefined) {
        event.preventDefault()
        onEscape()
      } else if (inList && event.key === " ") {
        event.preventDefault()
        pick(cursor, false)
      } else if (inList && /^[1-9]$/.test(event.key) && Number(event.key) <= rows.length) {
        event.preventDefault()
        pick(rows[Number(event.key) - 1]!, true)
      }
    }
    // Capture phase: runs before a field's own handler can empty itself and change who drives the list.
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  })

  const row = (id: string, index: number, content: React.ReactNode) => {
    const checked = selected.includes(id)
    return (
      <div
        key={id}
        ref={(node) => {
          if (node) rowElements.current.set(id, node)
          else rowElements.current.delete(id)
        }}
        role={multiple ? "checkbox" : "radio"}
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        tabIndex={id === cursor ? 0 : -1}
        className="iv-choice-list__option"
        data-cursor={id === cursor || undefined}
        onFocus={(event) => {
          if (event.target === event.currentTarget) setCursor(id)
        }}
        onClick={() => {
          if (!disabled) pick(id, true)
        }}
      >
        <span className="iv-choice-list__mark" aria-hidden="true">
          {multiple && checked ? <Icon name="check" size={12} /> : null}
        </span>
        {content}
        <kbd className="iv-choice-list__hint">{index + 1}</kbd>
      </div>
    )
  }

  return (
    <div
      className="iv-choice-list"
      data-multiple={multiple || undefined}
      role={multiple ? "group" : "radiogroup"}
      aria-label={label}
      ref={root}
    >
      {options.map((option, index) =>
        row(
          option.id,
          index,
          <>
            <span className="iv-choice-list__label">{option.label}</span>
            {option.description === undefined ? null : (
              <span className="iv-choice-list__description">{option.description}</span>
            )}
          </>,
        ),
      )}
      {other === undefined
        ? null
        : row(
            other.id,
            options.length,
            <>
              <span className="iv-choice-list__label">{other.label}</span>
              {editing ? (
                <span
                  className="iv-choice-list__field"
                  onClick={(event) => event.stopPropagation()}
                >
                  <TextField
                    label={other.label}
                    value={other.text}
                    placeholder={other.placeholder}
                    autoFocus
                    disabled={disabled}
                    onChange={(event) => other.onTextChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) return
                      if (event.key === "Enter") {
                        event.preventDefault()
                        if (otherEmpty) return closeOther(other.id)
                        setEditing(false)
                        if (multiple) focusRow(other.id)
                        else onSubmit([other.id])
                      } else if (event.key === "Escape") {
                        event.preventDefault()
                        closeOther(other.id)
                      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                        event.preventDefault()
                        closeOther(step(other.id, event.key === "ArrowDown" ? 1 : -1))
                      }
                    }}
                  />
                </span>
              ) : (
                <span className="iv-choice-list__description" data-empty={otherEmpty || undefined}>
                  {otherEmpty ? other.placeholder : other.text}
                </span>
              )}
            </>,
          )}
    </div>
  )
}
