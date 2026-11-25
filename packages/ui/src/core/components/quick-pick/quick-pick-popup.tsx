import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import type { QuickPickItem, QuickPickProps } from "@ivin/plugin-api/ui"
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { Icon } from "../icon/icon.tsx"
import { KeyHints } from "../key-hints/key-hints.tsx"
import "./quick-pick.css"

const STATUS_LETTER = {
  modified: "M",
  added: "A",
  untracked: "U",
  deleted: "D",
  conflicted: "C",
} as const

function Label({ item }: { item: QuickPickItem }) {
  if (item.match === undefined || item.match.length === 0)
    return <span className="iv-quick-pick__label">{item.label}</span>
  const marked = new Set(item.match)
  return (
    <span className="iv-quick-pick__label">
      {Array.from(item.label).map((char, index) =>
        marked.has(index) ? (
          // oxlint-disable-next-line react/no-array-index-key
          <mark key={index} className="iv-quick-pick__match">
            {char}
          </mark>
        ) : (
          char
        ),
      )}
    </span>
  )
}

export default function QuickPickPopup({
  open,
  onOpenChange,
  label,
  placeholder,
  query,
  onQueryChange,
  items,
  onPick,
  message,
  footer,
}: QuickPickProps) {
  const listId = useId()
  const list = useRef<HTMLDivElement>(null)
  const [highlighted, setHighlighted] = useState(0)
  const [shown, setShown] = useState({ items, query })
  if (shown.items !== items || shown.query !== query) {
    setShown({ items, query })
    setHighlighted(0)
  }
  const current = items[Math.min(highlighted, items.length - 1)]
  const showList = message === undefined && items.length > 0
  const optionId = (index: number) => `${listId}-${index}`

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
  }, [highlighted, items])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      setHighlighted((index) => Math.max(0, Math.min(items.length - 1, index + step)))
    } else if (event.key === "Enter" && current !== undefined && showList) {
      event.preventDefault()
      onPick(current.id)
    }
  }

  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="iv-quick-pick__backdrop" />
        <BaseDialog.Popup className="iv-quick-pick" aria-label={label}>
          <div className="iv-quick-pick__field">
            <Icon name="search" size={16} />
            <input
              className="iv-quick-pick__input"
              type="text"
              role="combobox"
              aria-label={label}
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              {...(showList &&
                current !== undefined && {
                  "aria-activedescendant": optionId(items.indexOf(current)),
                })}
              placeholder={placeholder}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {showList ? (
            <div
              className="iv-quick-pick__list"
              role="listbox"
              id={listId}
              aria-label={label}
              ref={list}
            >
              {items.map((item, index) => (
                <div
                  key={item.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={item === current}
                  className="iv-quick-pick__option"
                  data-status={item.status}
                  onMouseMove={() => setHighlighted(index)}
                  onClick={() => onPick(item.id)}
                >
                  <Icon name="file" size={14} />
                  <Label item={item} />
                  {item.detail === undefined ? null : (
                    <span className="iv-quick-pick__detail">{item.detail}</span>
                  )}
                  {item.status === undefined ? null : (
                    <span className="iv-quick-pick__status" aria-hidden>
                      {STATUS_LETTER[item.status]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="iv-quick-pick__message">{message}</div>
          )}
          <div className="iv-quick-pick__foot">
            <KeyHints
              hints={[
                { key: "↑↓", label: "Move" },
                { key: "↵", label: "Open" },
                { key: "Esc", label: "Close" },
              ]}
            />
            {footer === undefined ? null : <span className="iv-quick-pick__count">{footer}</span>}
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
