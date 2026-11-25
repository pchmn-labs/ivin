import { Combobox } from "@base-ui/react/combobox"
import { useState } from "react"
import { Icon } from "../icon/icon.tsx"
import type { OpenedBy } from "../lazy-popup/lazy-popup.tsx"
import {
  ComposerMenuNote,
  type ComposerMenuGroup,
  type ComposerMenuItem,
  type ComposerMenuProps,
} from "./composer-menu.tsx"
import "./composer-menu.css"

// Rows the 360px menu holds beside a one-line footer.
const ROWS_WITHOUT_SEARCH = 10

const rowCount = (groups: ReadonlyArray<ComposerMenuGroup<unknown>>) =>
  groups.reduce((rows, group) => rows + group.items.length + (group.label ? 1 : 0), 0)

export default function ComposerMenuPopup<T>({
  label,
  trigger,
  groups,
  onPick,
  searchPlaceholder,
  noMatch,
  disabled,
  open: openProp,
  onOpenChange,
  keepOpenOnPick = false,
  onHighlight,
  checkedLabel = "Chosen",
  searchStatus,
  status,
  children,
  openedBy,
}: ComposerMenuProps<T> & { openedBy?: OpenedBy | undefined }) {
  const [ownOpen, setOwnOpen] = useState(openedBy !== undefined)
  const [query, setQuery] = useState("")
  const [keptSearch, setKeptSearch] = useState(false)
  const open = openProp ?? ownOpen
  const searchable = keptSearch || rowCount(groups) > ROWS_WITHOUT_SEARCH
  // A list that shrinks while open keeps its search field and what the user typed in it.
  if (open && searchable && !keptSearch) setKeptSearch(true)
  const trimmed = query.trim()

  return (
    <Combobox.Root<ComposerMenuItem<T>>
      items={groups}
      value={null}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.key === b.key}
      autoHighlight
      open={open}
      onOpenChange={(next, details) => {
        if (!next && keepOpenOnPick && details.reason === "item-press") return
        setOwnOpen(next)
        if (next) setQuery("")
        else setKeptSearch(false)
        onOpenChange?.(next)
      }}
      inputValue={query}
      onInputValueChange={(value, details) => {
        if (details.reason === "input-change" || details.reason === "input-clear") setQuery(value)
      }}
      onValueChange={(picked) => {
        if (picked) onPick(picked.value)
      }}
      {...(onHighlight && { onItemHighlighted: (item) => onHighlight(item?.value) })}
    >
      <Combobox.Trigger render={trigger} disabled={disabled} />
      <Combobox.Portal>
        <Combobox.Positioner
          side="top"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
        >
          <Combobox.Popup className="iv-composer-menu" aria-label={label}>
            {searchable ? (
              <div className="iv-composer-menu__search">
                <Icon name="search" size={14} />
                <Combobox.Input
                  className="iv-composer-menu__input"
                  placeholder={searchPlaceholder}
                  aria-label={label}
                  spellCheck={false}
                  // Takes focus from the hidden input when a list grows past the limit while open.
                  autoFocus
                />
                {searchStatus}
              </div>
            ) : (
              // The arrow keys move the highlight from the combobox input, so a short list keeps one, hidden.
              <Combobox.Input className="iv-composer-menu__keys" aria-label={label} readOnly />
            )}
            <div className="iv-composer-menu__viewport">
              <Combobox.Empty>
                {trimmed !== "" && <div className="iv-composer-menu__note">{noMatch(trimmed)}</div>}
              </Combobox.Empty>
              <Combobox.List className="iv-composer-menu__list">
                {(group: ComposerMenuGroup<T>, index: number) => (
                  <Combobox.Group
                    key={group.label ?? index}
                    items={group.items}
                    className="iv-composer-menu__group"
                  >
                    {group.label && (
                      <Combobox.GroupLabel className="iv-composer-menu__heading">
                        {group.label}
                      </Combobox.GroupLabel>
                    )}
                    <Combobox.Collection>
                      {(item: ComposerMenuItem<T>) => (
                        <Row key={item.key} item={item} checkedLabel={checkedLabel} />
                      )}
                    </Combobox.Collection>
                  </Combobox.Group>
                )}
              </Combobox.List>
              {!searchable && searchStatus && <ComposerMenuNote>{searchStatus}</ComposerMenuNote>}
              {status?.(trimmed)}
            </div>
            {children}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

function Row<T>({ item, checkedLabel }: { item: ComposerMenuItem<T>; checkedLabel: string }) {
  const shown =
    item.prefix !== undefined && item.label.startsWith(item.prefix)
      ? item.label.slice(item.prefix.length)
      : item.label
  return (
    <Combobox.Item
      value={item}
      className="iv-composer-menu__item"
      data-muted={item.muted || undefined}
      data-mono={item.mono || undefined}
      data-testid={item.testId}
    >
      {item.icon && (
        <span className="iv-composer-menu__icon" data-accent={item.accent || undefined}>
          <Icon name={item.icon} size={14} />
        </span>
      )}
      <span className="iv-composer-menu__label" title={item.label}>
        {shown !== item.label && <span className="iv-composer-menu__prefix">{item.prefix}</span>}
        {shown}
      </span>
      {item.tag !== undefined && <span className="iv-composer-menu__tag">{item.tag}</span>}
      {item.hint !== undefined && <span className="iv-composer-menu__hint">{item.hint}</span>}
      {item.checked !== undefined && (
        <span className="iv-composer-menu__check">
          {item.checked && <Icon name="check" size={14} label={checkedLabel} />}
        </span>
      )}
    </Combobox.Item>
  )
}
