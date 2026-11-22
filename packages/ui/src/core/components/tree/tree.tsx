import {
  selectionFeature,
  syncDataLoaderFeature,
  type ItemInstance,
  type TreeDataLoader,
} from "@headless-tree/core"
import { useTree } from "@headless-tree/react/react-compiler"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { TreeProps, TreeRow } from "@ivin/plugin-api/ui"
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react"
import { useCommandHandlers } from "../../../modules/command/hooks/use-command-handler.ts"
import { Icon } from "../icon/icon.tsx"
import "./tree.css"

export type { TreeProps, TreeRow }

// One row and its padding; keep in step with `--iv-tree-row-height`.
const ROW_HEIGHT = 24
const OVERSCAN = 8
const ROOT = "\0root"
// Keys typed closer together than this make one name to jump to.
const TYPE_AHEAD_MS = 800

interface Structure {
  readonly byId: ReadonlyMap<string, TreeRow>
  readonly children: ReadonlyMap<string, ReadonlyArray<string>>
  readonly expanded: Array<string>
}

const structureOf = (rows: ReadonlyArray<TreeRow>): Structure => {
  const byId = new Map<string, TreeRow>()
  const children = new Map<string, Array<string>>([[ROOT, []]])
  const parents: Array<string> = [ROOT]
  const expanded: Array<string> = []
  for (const row of rows) {
    byId.set(row.id, row)
    parents.length = row.depth + 1
    const parent = parents[row.depth] ?? ROOT
    const siblings = children.get(parent)
    if (siblings === undefined) children.set(parent, [row.id])
    else siblings.push(row.id)
    parents.push(row.id)
    if (row.expanded === true) expanded.push(row.id)
  }
  return { byId, children, expanded }
}

// The rows stay out of the tab order: the tree takes the focus and names its active row, so the
// focus survives a row scrolled out of the virtualised list.
export function Tree({ label, rows, onToggle, onOpen, "data-testid": testId }: TreeProps) {
  const domId = useId()
  const scroller = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: "", at: 0 })
  const [hasFocus, setHasFocus] = useState(false)
  // No row looks active until the tree takes the focus or a row is clicked.
  const [engaged, setEngaged] = useState(false)

  const structure = useMemo(() => structureOf(rows), [rows])
  const latest = useRef(structure)
  latest.current = structure
  const [dataLoader] = useState<TreeDataLoader<TreeRow | null>>(() => ({
    getItem: (id) => latest.current.byId.get(id) ?? null,
    getChildren: (id) => [...(latest.current.children.get(id) ?? [])],
  }))

  const tree = useTree<TreeRow | null>({
    rootItemId: ROOT,
    dataLoader,
    getItemName: (item) => item.getItemData()?.name ?? "",
    isItemFolder: (item) => item.getItemData()?.expanded != null,
    // The library's own hotkeys are left out: each key is a command the user can rebind.
    features: [syncDataLoaderFeature, selectionFeature],
    state: { expandedItems: structure.expanded },
    scrollToItem: (item) => virtualizer.scrollToIndex(item.getItemMeta().index),
  })()
  useEffect(() => tree.rebuildTree(), [tree, structure])

  const items = tree.getItems()
  const found = items.indexOf(tree.getFocusedItem())
  const focusedIndex = found === -1 ? 0 : found
  const focused = items[focusedIndex]

  // The React Compiler skips this component, as TanStack Virtual hands back one mutable instance.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })
  const visible = virtualizer.getVirtualItems()
  const before = visible[0]?.start ?? 0
  const after = virtualizer.getTotalSize() - (visible.at(-1)?.end ?? 0)
  useLayoutEffect(() => {
    list.current?.style.setProperty("--iv-tree-before", `${before}px`)
    list.current?.style.setProperty("--iv-tree-after", `${after}px`)
  }, [before, after])

  const rowDomId = (index: number) => `${domId}-${index}`
  const anchorAt = (id: string) => {
    // Internal to the library: where a Shift move or click extends the selection from.
    tree.getDataRef<{ selectUpToAnchorId?: string }>().current.selectUpToAnchorId = id
  }

  const moveTo = (index: number, extend = false) => {
    const target = items[Math.max(0, Math.min(items.length - 1, index))]
    if (target === undefined) return
    setEngaged(true)
    target.setFocused()
    if (extend) target.selectUpTo(false)
    else {
      tree.setSelectedItems([target.getId()])
      anchorAt(target.getId())
    }
    virtualizer.scrollToIndex(target.getItemMeta().index)
  }

  const activate = (item: ItemInstance<TreeRow | null>) => {
    const row = item.getItemData()
    if (row === null) return
    if (row.expanded === null) onOpen?.(row.id)
    else onToggle(row.id)
  }

  const page = () => Math.max(1, Math.floor((scroller.current?.clientHeight ?? 0) / ROW_HEIGHT) - 1)

  const onFocused = (run: (item: ItemInstance<TreeRow | null>) => void) => () => {
    if (focused !== undefined) run(focused)
  }
  useCommandHandlers(
    {
      "tree.focusNext": () => moveTo(focusedIndex + 1),
      "tree.focusPrevious": () => moveTo(focusedIndex - 1),
      "tree.selectNext": () => moveTo(focusedIndex + 1, true),
      "tree.selectPrevious": () => moveTo(focusedIndex - 1, true),
      "tree.focusFirst": () => moveTo(0),
      "tree.focusLast": () => moveTo(items.length - 1),
      "tree.focusPageDown": () => moveTo(focusedIndex + page()),
      "tree.focusPageUp": () => moveTo(focusedIndex - page()),
      "tree.expandOrEnter": onFocused((item) => {
        const row = item.getItemData()
        if (row === null || row.expanded === null) return
        if (!row.expanded) onToggle(row.id)
        else if (item.getChildren().length > 0) moveTo(focusedIndex + 1)
      }),
      "tree.collapseOrParent": onFocused((item) => {
        const row = item.getItemData()
        if (row?.expanded === true) return onToggle(row.id)
        const parent = item.getParent()
        if (parent !== undefined && parent.getId() !== ROOT) moveTo(parent.getItemMeta().index)
      }),
      "tree.open": onFocused(activate),
    },
    hasFocus,
  )

  const typeAhead = (event: KeyboardEvent) => {
    if (event.key.length !== 1 || event.key === " ") return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const now = Date.now()
    const key = event.key.toLowerCase()
    const t = typed.current
    t.text = now - t.at > TYPE_AHEAD_MS ? key : t.text + key
    t.at = now
    // A first key looks past the active row, so the same letter again goes to the next match.
    const start = t.text.length === 1 ? focusedIndex + 1 : focusedIndex
    const order = [...items.slice(start), ...items.slice(0, start)]
    const match = order.find((item) => item.getItemName().toLowerCase().startsWith(t.text))
    if (match === undefined) return
    event.preventDefault()
    moveTo(match.getItemMeta().index)
  }

  const onRowClick = (event: MouseEvent, item: ItemInstance<TreeRow | null>) => {
    setEngaged(true)
    item.setFocused()
    const toggle = event.metaKey || event.ctrlKey
    if (event.shiftKey) return item.selectUpTo(toggle)
    anchorAt(item.getId())
    if (toggle) return item.toggleSelect()
    tree.setSelectedItems([item.getId()])
    activate(item)
  }

  return (
    <div className="iv-tree" data-keybinding-area="tree" data-testid={testId}>
      <div className="iv-tree__list" ref={scroller}>
        <div
          {...tree.getContainerProps(label)}
          ref={list}
          className="iv-tree__rows"
          tabIndex={0}
          aria-multiselectable
          {...(engaged &&
            focused !== undefined && { "aria-activedescendant": rowDomId(focusedIndex) })}
          onKeyDown={typeAhead}
          onFocus={() => {
            setHasFocus(true)
            setEngaged(true)
          }}
          onBlur={() => setHasFocus(false)}
        >
          {visible.map(({ index }) => {
            const item = items[index]
            const row = item?.getItemData()
            if (item === undefined || row == null) return null
            const { tabIndex: _, onClick: __, ...props } = item.getProps()
            return (
              <div
                key={item.getKey()}
                {...props}
                id={rowDomId(index)}
                className="iv-tree__row"
                data-active={(engaged && index === focusedIndex) || undefined}
                onClick={(event) => onRowClick(event, item)}
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
