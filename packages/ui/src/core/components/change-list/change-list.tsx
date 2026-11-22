import type { ChangeListItem, ChangeListProps } from "@ivin/plugin-api/ui"
import { useState, type KeyboardEvent } from "react"
import { IconButton } from "../button/button.tsx"
import "./change-list.css"

export type { ChangeListItem, ChangeListProps }

const LETTERS = { modified: "M", added: "A", deleted: "D", renamed: "R", untracked: "U" } as const

const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
  const rows = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(".iv-change-list__main"),
  )
  const current = rows.indexOf(document.activeElement as HTMLButtonElement)
  if (current < 0) return
  const target = { ArrowUp: current - 1, ArrowDown: current + 1, Home: 0, End: rows.length - 1 }[
    event.key
  ]
  const next = target === undefined ? undefined : rows[target]
  if (next === undefined) return
  event.preventDefault()
  next.focus()
}

export function ChangeList({ label, items, selectedId, onOpen, onOpenFile }: ChangeListProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const tabStop =
    [focusedId, selectedId].find((id) => items.some((item) => item.id === id)) ?? items[0]?.id
  return (
    <ul className="iv-change-list" aria-label={label} onKeyDown={moveFocus}>
      {items.map((item) => (
        <li
          key={item.id}
          className="iv-change-list__row"
          data-status={item.status}
          data-selected={item.id === selectedId || undefined}
        >
          <button
            type="button"
            className="iv-change-list__main"
            tabIndex={item.id === tabStop ? 0 : -1}
            aria-current={item.id === selectedId ? "true" : undefined}
            title={item.title}
            onFocus={() => setFocusedId(item.id)}
            onClick={() => onOpen(item.id)}
          >
            <span className="iv-change-list__letter" aria-hidden>
              {LETTERS[item.status]}
            </span>
            <span className="iv-visually-hidden">{item.status}</span>
            <span className="iv-change-list__name">{item.name}</span>
            <span className="iv-change-list__folder">{item.folder}</span>
            {(item.added !== null || item.deleted !== null) && (
              <span className="iv-change-list__counts">
                {item.added ? <span className="iv-change-list__added">+{item.added}</span> : null}
                {item.deleted ? (
                  <span className="iv-change-list__deleted">−{item.deleted}</span>
                ) : null}
              </span>
            )}
          </button>
          {onOpenFile && item.status !== "deleted" && (
            <span className="iv-change-list__action">
              <IconButton
                icon="file"
                label={`Open ${item.name}`}
                tooltip="Open file"
                size="sm"
                onClick={() => onOpenFile(item.id)}
              />
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
