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
import { isMac } from "../../../modules/keybinding/adapters/platform.ts"
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
  readonly parents: ReadonlyMap<string, string>
  readonly expanded: Array<string>
}

const structureOf = (rows: ReadonlyArray<TreeRow>): Structure => {
  const byId = new Map<string, TreeRow>()
  const children = new Map<string, Array<string>>([[ROOT, []]])
  const parentOf = new Map<string, string>()
  const parents: Array<string> = [ROOT]
  const expanded: Array<string> = []
  for (const row of rows) {
    byId.set(row.id, row)
    parents.length = row.depth + 1
    const parent = parents[row.depth] ?? ROOT
    parentOf.set(row.id, parent)
    const siblings = children.get(parent)
    if (siblings === undefined) children.set(parent, [row.id])
    else siblings.push(row.id)
    parents.push(row.id)
    if (row.expanded === true) expanded.push(row.id)
  }
  return { byId, children, parents: parentOf, expanded }
}

// The rows stay out of the tab order: the tree takes the focus and names its active row, so the
// focus survives a row scrolled out of the virtualised list.
export function Tree({ label, rows, onToggle, onOpen, "data-testid": testId }: TreeProps) {
  const domId = useId()
  const scroller = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: "", at: 0 })
  // Every row's folder seen so far, to find where the focus goes when its row is hidden.
  const knownParents = useRef(new Map<string, string>())
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
    features: [syncDataLoaderFeature, selectionFeature],
    state: { expandedItems: structure.expanded },
    scrollToItem: (item) => virtualizer.scrollToIndex(item.getItemMeta().index),
  })()
  useEffect(() => {
    for (const [id, parent] of structure.parents) knownParents.current.set(id, parent)
    tree.rebuildTree()
    const selected = tree.getState().selectedItems ?? []
    const shown = selected.filter((id) => structure.byId.has(id))
    if (shown.length < selected.length) tree.setSelectedItems(shown)
    let focusedId = tree.getState().focusedItem ?? undefined
    if (focusedId === undefined || structure.byId.has(focusedId)) return
    while (focusedId !== undefined && focusedId !== ROOT && !structure.byId.has(focusedId))
      focusedId = knownParents.current.get(focusedId)
    if (focusedId === undefined || focusedId === ROOT) return
    tree.getItemInstance(focusedId).setFocused()
    anchorAt(focusedId)
  }, [tree, structure])

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
  // Internal to the library.
  const anchor = () => tree.getDataRef<{ selectUpToAnchorId?: string }>().current
  const anchorAt = (id: string) => {
    anchor().selectUpToAnchorId = id
  }
  const hasAnchor = () => {
    const id = anchor().selectUpToAnchorId
    return id !== undefined && latest.current.byId.has(id)
  }

  const moveTo = (index: number, extend = false) => {
    const target = items[Math.max(0, Math.min(items.length - 1, index))]
    if (target === undefined) return
    setEngaged(true)
    if (extend && !hasAnchor() && focused !== undefined) anchorAt(focused.getId())
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

  const rowsInView = () => {
    const top = scroller.current?.scrollTop ?? 0
    const height = scroller.current?.clientHeight ?? 0
    const first = Math.ceil(top / ROW_HEIGHT)
    const last = Math.max(first, Math.floor((top + height) / ROW_HEIGHT) - 1)
    return { first, last, page: Math.max(1, last - first) }
  }
  // As in VS Code: to the edge of the view first, then a page past it.
  const pageDown = () => {
    const { last, page } = rowsInView()
    moveTo(focusedIndex < last ? last : focusedIndex + page)
  }
  const pageUp = () => {
    const { first, page } = rowsInView()
    moveTo(focusedIndex > first ? first : focusedIndex - page)
  }

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
      "tree.focusPageDown": pageDown,
      "tree.focusPageUp": pageUp,
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
    if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return
    const now = Date.now()
    const key = event.key.toLowerCase()
    const t = typed.current
    const typing = now - t.at <= TYPE_AHEAD_MS && t.text !== ""
    // A space continues a name; on its own it is `tree.open`.
    if (key === " " && !typing) return
    t.text = typing ? t.text + key : key
    if (key === " ") event.preventDefault()
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
    // Ctrl-click is a right click on macOS.
    const toggle = isMac() ? event.metaKey : event.ctrlKey
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
