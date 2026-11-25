import type { CompletionItem } from "@ivin/plugin-api/ui"
import { useEffect, useRef } from "react"
import { KeyHints } from "../key-hints/key-hints.tsx"
import { type CompletionSheetProps, completionOptionId } from "./completion-sheet.tsx"
import "./completion-sheet.css"

const HINTS = [
  { key: "↑↓", label: "Move" },
  { key: "↵", label: "Pick" },
  { key: "Esc", label: "Close" },
]

function Label({ item, trigger }: { item: CompletionItem; trigger: string }) {
  const marked = new Set(item.match ?? [])
  return (
    <span className="iv-completion-sheet__label">
      <span className="iv-completion-sheet__trigger">{trigger}</span>
      {Array.from(item.label).map((char, index) =>
        marked.has(index) ? (
          // oxlint-disable-next-line react/no-array-index-key
          <mark key={index} className="iv-completion-sheet__match">
            {char}
          </mark>
        ) : (
          char
        ),
      )}
    </span>
  )
}

export default function CompletionSheetList({
  listId,
  trigger,
  title,
  items,
  active,
  message,
  onHover,
  onPick,
}: CompletionSheetProps) {
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
  }, [active, items])

  return (
    <div
      className="iv-completion-sheet"
      data-testid="completion-sheet"
      // A click on a row must leave the focus and the caret in the field.
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="iv-completion-sheet__head">
        <span>{title}</span>
        <KeyHints hints={HINTS} />
      </div>
      {items.length === 0 ? (
        <div className="iv-completion-sheet__message">{message}</div>
      ) : (
        <div
          className="iv-completion-sheet__list"
          role="listbox"
          id={listId}
          aria-label={title}
          ref={list}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              id={completionOptionId(listId, index)}
              role="option"
              aria-selected={index === active}
              className="iv-completion-sheet__option"
              onMouseMove={() => onHover(index)}
              onClick={() => onPick(item)}
            >
              <span className="iv-completion-sheet__line">
                <Label item={item} trigger={trigger} />
                {item.detail === undefined ? null : (
                  <span className="iv-completion-sheet__detail">{item.detail}</span>
                )}
                {item.tag === undefined ? null : (
                  <span className="iv-completion-sheet__tag">{item.tag}</span>
                )}
              </span>
              {item.description === undefined ? null : (
                <span className="iv-completion-sheet__description">{item.description}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
