import { useAtomValue } from "@effect/atom-react"
import type {
  ChangeGroup,
  ChangeListError,
  ChangeListItem,
  ChangeListProps,
  ChangeListRow,
} from "@ivin/plugin-api/ui"
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { fileIconsAtom } from "../../../modules/plugin/atoms/contributions.ts"
import { fileIconOf } from "../../../modules/plugin/rules/file-icon.ts"
import { IconButton } from "../button/button.tsx"
import { Icon } from "../icon/icon.tsx"
import "./change-list.css"

export type { ChangeGroup, ChangeListItem, ChangeListProps, ChangeListRow }

const LETTERS = { modified: "M", added: "A", deleted: "D", renamed: "R", untracked: "U" } as const

const headingKey = (group: ChangeGroup) => `heading\n${group.id}`
const rowKey = (group: ChangeGroup, item: ChangeListItem) => `row\n${group.id}\n${item.id}`

function ErrorLines({ error }: { error: ChangeListError }) {
  return (
    <div className="iv-change-list__error" role="alert">
      <Icon name="circle-alert" size={12} />
      <p className="iv-change-list__error-text">{error.text}</p>
      {error.detail !== null && <pre className="iv-change-list__error-detail">{error.detail}</pre>}
    </div>
  )
}

export function ChangeList({ label, groups, selected, onOpen, area, onFocusRow }: ChangeListProps) {
  const fileIcons = useAtomValue(fileIconsAtom)
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const lastIndex = useRef(0)

  const keys = groups.flatMap((group) => [
    headingKey(group),
    ...(folded.has(group.id) ? [] : group.items.map((item) => rowKey(group, item))),
  ])
  const selectedGroup = groups.find((group) => group.id === selected?.groupId)
  const selectedItem = selectedGroup?.items.find((item) => item.id === selected?.id)
  const selectedKey =
    selectedGroup && selectedItem ? rowKey(selectedGroup, selectedItem) : undefined
  const tabStop = [focusedKey, selectedKey].find((key) => key && keys.includes(key)) ?? keys[0]

  // A discarded row leaves while nothing holds the focus: give it to the row that took its place.
  useLayoutEffect(() => {
    if (focusedKey === null || keys.includes(focusedKey)) return
    if (document.activeElement !== document.body) return
    const nodes = root.current?.querySelectorAll<HTMLElement>("[data-nav]")
    nodes?.[Math.min(lastIndex.current, nodes.length - 1)]?.focus()
  })

  const focusOn = (key: string) => {
    setFocusedKey(key)
    lastIndex.current = keys.indexOf(key)
  }

  const fold = (group: ChangeGroup, value: boolean) =>
    setFolded((current) => {
      const next = new Set(current)
      if (value) next.add(group.id)
      else next.delete(group.id)
      return next
    })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-nav]"))
    const current = nodes.indexOf(document.activeElement as HTMLElement)
    if (current < 0) return
    const node = nodes[current] as HTMLElement
    const group = groups.find((candidate) => candidate.id === node.dataset.group)
    if (group === undefined) return
    const isHeading = node.dataset.nav === "heading"
    const move = (index: number) => {
      const next = nodes[index]
      if (next === undefined) return
      event.preventDefault()
      next.focus()
    }
    switch (event.key) {
      case "ArrowUp":
        return move(current - 1)
      case "ArrowDown":
        return move(current + 1)
      case "Home":
        return move(0)
      case "End":
        return move(nodes.length - 1)
      case "ArrowLeft":
        event.preventDefault()
        if (isHeading) fold(group, true)
        else nodes.find((candidate) => candidate.dataset.key === headingKey(group))?.focus()
        return
      case "ArrowRight":
        if (!isHeading) return
        event.preventDefault()
        return fold(group, false)
    }
  }

  return (
    <div
      className="iv-change-list"
      aria-label={label}
      role="group"
      ref={root}
      data-keybinding-area={area}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onFocusRow?.(null)
      }}
    >
      {groups.map((group) => {
        const open = !folded.has(group.id)
        const key = headingKey(group)
        return (
          <section key={group.id} className="iv-change-list__group" aria-label={group.heading}>
            <div className="iv-change-list__heading">
              <button
                type="button"
                className="iv-change-list__toggle"
                aria-expanded={open}
                title={group.title}
                tabIndex={key === tabStop ? 0 : -1}
                data-nav="heading"
                data-key={key}
                data-group={group.id}
                onFocus={() => {
                  focusOn(key)
                  onFocusRow?.(null)
                }}
                onClick={() => fold(group, open)}
              >
                <span className="iv-change-list__chevron" aria-hidden>
                  <Icon name="chevron-right" size={12} />
                </span>
                {group.heading} <span className="iv-change-list__count">{group.items.length}</span>
              </button>
              {group.discardAll && (
                <IconButton
                  icon="undo"
                  label={group.discardAll.label}
                  tooltip={`${group.discardAll.label}…`}
                  size="sm"
                  tabIndex={-1}
                  onClick={group.discardAll.onDiscard}
                />
              )}
            </div>
            {group.error && <ErrorLines error={group.error} />}
            {open && (
              <ul className="iv-change-list__rows" aria-label={group.label}>
                {group.items.map((item) => {
                  const itemKey = rowKey(group, item)
                  const isSelected = itemKey === selectedKey
                  return (
                    <li key={item.id} className="iv-change-list__item">
                      <div
                        className="iv-change-list__row"
                        data-status={item.status}
                        data-selected={isSelected || undefined}
                      >
                        <button
                          type="button"
                          className="iv-change-list__main"
                          tabIndex={itemKey === tabStop ? 0 : -1}
                          aria-current={isSelected ? "true" : undefined}
                          title={item.title}
                          data-nav="row"
                          data-key={itemKey}
                          data-group={group.id}
                          onFocus={() => {
                            focusOn(itemKey)
                            onFocusRow?.({ groupId: group.id, id: item.id })
                          }}
                          onClick={() => onOpen({ groupId: group.id, id: item.id })}
                        >
                          <span className="iv-change-list__icon" aria-hidden>
                            {fileIconOf(fileIcons, {
                              name: item.name,
                              folder: false,
                              open: false,
                            }) ?? <Icon name="file" size={14} />}
                            <span className="iv-change-list__letter">{LETTERS[item.status]}</span>
                          </span>
                          <span className="iv-visually-hidden">{item.status}</span>
                          <span className="iv-change-list__name">{item.name}</span>
                          <span className="iv-change-list__folder">{item.folder}</span>
                          {(item.added !== null || item.deleted !== null) && (
                            <span className="iv-change-list__counts">
                              {item.added ? (
                                <span className="iv-change-list__added">+{item.added}</span>
                              ) : null}
                              {item.deleted ? (
                                <span className="iv-change-list__deleted">−{item.deleted}</span>
                              ) : null}
                            </span>
                          )}
                        </button>
                        {group.onDiscard && (
                          <span className="iv-change-list__action">
                            <IconButton
                              icon="undo"
                              label={`Discard the changes to ${item.name}`}
                              tooltip="Discard changes…"
                              size="sm"
                              tabIndex={-1}
                              onClick={() => {
                                focusOn(itemKey)
                                group.onDiscard?.(item.id)
                              }}
                            />
                          </span>
                        )}
                      </div>
                      {item.error && <ErrorLines error={item.error} />}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
