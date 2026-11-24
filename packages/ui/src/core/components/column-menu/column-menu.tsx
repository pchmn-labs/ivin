import { Popover } from "@base-ui/react/popover"
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react"
import { Icon } from "../icon/icon.tsx"
import { KeyHints } from "../key-hints/key-hints.tsx"
import "./column-menu.css"

export interface ColumnMenuItem {
  readonly value: string
  readonly label: string
  readonly description?: string | null
  readonly checked: boolean
  readonly disabled?: boolean
  readonly testId?: string
}

export interface ColumnMenuSection {
  readonly label?: string
  readonly items: ReadonlyArray<ColumnMenuItem>
}

export interface ColumnMenuColumn {
  readonly key: string
  readonly label: string
  readonly sections: ReadonlyArray<ColumnMenuSection>
  readonly wide?: boolean
  readonly note?: string
}

export interface ColumnMenuProps {
  readonly label: string
  readonly trigger: ReactElement
  readonly columns: ReadonlyArray<ColumnMenuColumn>
  readonly onPick: (column: string, value: string) => void
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly startColumn?: string
  readonly hint: string
  readonly children?: ReactNode
}

interface Spot {
  readonly column: number
  readonly row: number
}

const itemsOf = (column: ColumnMenuColumn) => column.sections.flatMap((section) => section.items)

const usable = (columns: ReadonlyArray<ColumnMenuColumn>, { column, row }: Spot) => {
  const item = columns[column] && itemsOf(columns[column])[row]
  return item !== undefined && !item.disabled
}

const startSpot = (columns: ReadonlyArray<ColumnMenuColumn>, startColumn?: string): Spot => {
  const column = Math.max(
    0,
    columns.findIndex((candidate) => candidate.key === startColumn),
  )
  const items = itemsOf(columns[column]!)
  const checked = items.findIndex((item) => item.checked && !item.disabled)
  return {
    column,
    row:
      checked >= 0
        ? checked
        : Math.max(
            0,
            items.findIndex((item) => !item.disabled),
          ),
  }
}

const stepRow = (columns: ReadonlyArray<ColumnMenuColumn>, spot: Spot, step: 1 | -1): Spot => {
  const count = itemsOf(columns[spot.column]!).length
  for (let offset = 1; offset < count; offset++) {
    const row = (spot.row + step * offset + count) % count
    if (usable(columns, { column: spot.column, row })) return { column: spot.column, row }
  }
  return spot
}

const edgeRow = (columns: ReadonlyArray<ColumnMenuColumn>, column: number, last: boolean): Spot => {
  const rows = itemsOf(columns[column]!).map((_, row) => row)
  const row = (last ? rows.reverse() : rows).find((candidate) =>
    usable(columns, { column, row: candidate }),
  )
  return row === undefined ? { column, row: 0 } : { column, row }
}

const stepColumn = (columns: ReadonlyArray<ColumnMenuColumn>, spot: Spot, step: 1 | -1): Spot => {
  for (let offset = 1; offset < columns.length; offset++) {
    const column = (spot.column + step * offset + columns.length) % columns.length
    const rows = itemsOf(columns[column]!)
      .map((_, row) => row)
      .filter((row) => usable(columns, { column, row }))
    if (rows.length === 0) continue
    const row = rows.reduce((best, row) =>
      Math.abs(row - spot.row) < Math.abs(best - spot.row) ? row : best,
    )
    return { column, row }
  }
  return spot
}

export function ColumnMenu({
  label,
  trigger,
  columns,
  onPick,
  open,
  onOpenChange,
  startColumn,
  hint,
  children,
}: ColumnMenuProps) {
  const id = useId()
  const body = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<Spot>(() => startSpot(columns, startColumn))
  const optionId = ({ column, row }: Spot) => `${id}-${column}-${row}`
  const current = columns[spot.column]
  const highlighted = current && itemsOf(current)[spot.row]

  useEffect(() => {
    if (open) setSpot(startSpot(columns, startColumn))
    // Only on opening: a pick re-renders the columns and must keep the highlight.
  }, [open, startColumn])

  useEffect(() => {
    if (open) document.getElementById(optionId(spot))?.scrollIntoView({ block: "nearest" })
  }, [open, spot])

  const pick = (at: Spot) => {
    const item = itemsOf(columns[at.column]!)[at.row]
    if (!item || item.disabled) return
    setSpot(at)
    onPick(columns[at.column]!.key, item.value)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, () => Spot> = {
      ArrowDown: () => stepRow(columns, spot, 1),
      ArrowUp: () => stepRow(columns, spot, -1),
      ArrowRight: () => stepColumn(columns, spot, 1),
      ArrowLeft: () => stepColumn(columns, spot, -1),
      Home: () => edgeRow(columns, spot.column, false),
      End: () => edgeRow(columns, spot.column, true),
    }
    const move = moves[event.key]
    if (move) setSpot(move())
    else if (event.key === "Enter" || event.key === " ") pick(spot)
    else return
    event.preventDefault()
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger render={trigger} />
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
        >
          <Popover.Popup className="iv-column-menu" initialFocus={body} aria-label={label}>
            <div
              ref={body}
              className="iv-column-menu__columns"
              role="group"
              aria-label={label}
              tabIndex={0}
              aria-activedescendant={highlighted ? optionId(spot) : undefined}
              onKeyDown={onKeyDown}
            >
              {columns.map((column, columnIndex) => {
                let row = 0
                return (
                  <div
                    key={column.key}
                    className="iv-column-menu__column"
                    data-wide={column.wide || undefined}
                    role="listbox"
                    aria-label={column.label}
                  >
                    <div className="iv-column-menu__heading" aria-hidden="true">
                      {column.label}
                    </div>
                    {column.sections.map((section, sectionIndex) => (
                      <div
                        key={section.label ?? sectionIndex}
                        className="iv-column-menu__section"
                        role="group"
                        aria-label={section.label}
                      >
                        {section.label && (
                          <div className="iv-column-menu__subheading" aria-hidden="true">
                            {section.label}
                          </div>
                        )}
                        {section.items.map((item) => {
                          const at = { column: columnIndex, row: row++ }
                          const isHighlighted = at.column === spot.column && at.row === spot.row
                          return (
                            <div
                              key={item.value}
                              id={optionId(at)}
                              className="iv-column-menu__item"
                              role="option"
                              aria-labelledby={`${optionId(at)}-label`}
                              aria-describedby={
                                item.description ? `${optionId(at)}-description` : undefined
                              }
                              aria-selected={item.checked}
                              aria-disabled={item.disabled || undefined}
                              data-highlighted={(isHighlighted && !item.disabled) || undefined}
                              data-testid={item.testId}
                              onMouseMove={() => {
                                if (!item.disabled && !isHighlighted) setSpot(at)
                              }}
                              onClick={() => pick(at)}
                            >
                              <span className="iv-column-menu__text">
                                <span
                                  id={`${optionId(at)}-label`}
                                  className="iv-column-menu__label"
                                  title={item.label}
                                >
                                  {item.label}
                                </span>
                                {item.description && (
                                  <span
                                    id={`${optionId(at)}-description`}
                                    className="iv-column-menu__description"
                                  >
                                    {item.description}
                                  </span>
                                )}
                              </span>
                              <span className="iv-column-menu__check">
                                {item.checked && !item.disabled && (
                                  <Icon name="check" size={14} label="Current" />
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                    {column.note && <div className="iv-column-menu__note">{column.note}</div>}
                  </div>
                )
              })}
            </div>
            {children}
            <div className="iv-column-menu__foot">
              <span className="iv-column-menu__hint">{hint}</span>
              <KeyHints
                hints={[
                  { key: "↑↓ ←→", label: "Move" },
                  { key: "↵", label: "Pick" },
                  { key: "Esc", label: "Close" },
                ]}
              />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function ColumnMenuNote({ children }: { children: ReactNode }) {
  return (
    <div className="iv-column-menu__wide-note" role="status">
      {children}
    </div>
  )
}
