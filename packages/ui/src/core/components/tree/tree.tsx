import type { TreeProps, TreeRow } from "@ivin/plugin-api/ui"
import { useId, useRef, useState, type KeyboardEvent } from "react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { Icon } from "../icon/icon.tsx"
import "./tree.css"

export type { TreeProps, TreeRow }

// One row and its padding; keep in step with `--iv-tree-row-height`.
const ROW_HEIGHT = 24

const parentIndex = (rows: ReadonlyArray<TreeRow>, index: number) => {
  const depth = rows[index]?.depth ?? 0
  for (let i = index - 1; i >= 0; i--) if (rows[i]!.depth < depth) return i
  return index
}

// The rows stay out of the tab order: the tree takes the focus and names its active row, so the
// focus survives a row scrolled out of the virtualised list.
export function Tree({ label, rows, onToggle, onOpen, "data-testid": testId }: TreeProps) {
  const domId = useId()
  const list = useRef<VirtuosoHandle>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  // -1 until the tree takes the focus or a row is clicked; a row that disappears hands over to the first.
  const found = rows.findIndex((row) => row.id === activeId)
  const activeIndex = activeId === null ? -1 : Math.max(found, 0)
  const active = rows[activeIndex]
  const rowDomId = (index: number) => `${domId}-${index}`

  const moveTo = (index: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))]
    if (row === undefined) return
    setActiveId(row.id)
    list.current?.scrollIntoView({ index: rows.indexOf(row) })
  }

  const activate = (row: TreeRow) => (row.expanded === null ? onOpen?.(row.id) : onToggle(row.id))

  const onKeyDown = (event: KeyboardEvent) => {
    if (active === undefined) {
      // The focus came before the rows did.
      if (rows[0] !== undefined) setActiveId(rows[0].id)
      return
    }
    const keys: Record<string, () => void> = {
      ArrowDown: () => moveTo(activeIndex + 1),
      ArrowUp: () => moveTo(activeIndex - 1),
      Home: () => moveTo(0),
      End: () => moveTo(rows.length - 1),
      ArrowRight: () => {
        if (active.expanded === false) onToggle(active.id)
        else if (active.expanded === true && rows[activeIndex + 1]?.depth === active.depth + 1)
          moveTo(activeIndex + 1)
      },
      ArrowLeft: () => {
        if (active.expanded === true) onToggle(active.id)
        else moveTo(parentIndex(rows, activeIndex))
      },
      Enter: () => activate(active),
      " ": () => activate(active),
    }
    const run = keys[event.key]
    if (run === undefined || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    run()
  }

  return (
    <div
      className="iv-tree"
      role="tree"
      aria-label={label}
      tabIndex={0}
      {...(active !== undefined && { "aria-activedescendant": rowDomId(activeIndex) })}
      onKeyDown={onKeyDown}
      onFocus={() => activeId === null && rows[0] !== undefined && setActiveId(rows[0].id)}
      data-testid={testId}
    >
      <Virtuoso
        className="iv-tree__list"
        data={rows}
        fixedItemHeight={ROW_HEIGHT}
        computeItemKey={(_, row) => row.id}
        itemContent={(index, row) => (
          <div
            id={rowDomId(index)}
            className="iv-tree__row"
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={index === activeIndex}
            {...(row.expanded !== null && { "aria-expanded": row.expanded })}
            data-active={index === activeIndex || undefined}
            onClick={() => {
              setActiveId(row.id)
              activate(row)
            }}
          >
            {Array.from({ length: row.depth }, (_, level) => (
              <span key={level} className="iv-tree__indent" />
            ))}
            <span className="iv-tree__chevron" aria-hidden>
              {row.expanded === null ? null : <Icon name="chevron-right" size={12} />}
            </span>
            <span className="iv-tree__icon" aria-hidden>
              <Icon name={row.expanded === null ? "file" : "folder"} size={14} />
            </span>
            <span className="iv-tree__name">{row.name}</span>
          </div>
        )}
      />
    </div>
  )
}
