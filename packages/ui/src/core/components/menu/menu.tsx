import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu"
import { Menu as BaseMenu } from "@base-ui/react/menu"
import type { MenuItem, MenuProps } from "@ivin/plugin-api/ui"
import type { ReactElement, ReactNode } from "react"
import { Icon } from "../icon/icon.tsx"
import "./menu.css"

export type { MenuProps }

type Action = Exclude<MenuItem, "separator" | { readonly heading: string }> & {
  // In place of the icon.
  readonly leading?: ReactNode
  readonly trailing?: ReactNode
  readonly "aria-label"?: string
}

export type CoreMenuItem = Action | "separator" | { readonly heading: string }

export interface CoreMenuProps extends Omit<MenuProps, "items"> {
  readonly items: ReadonlyArray<CoreMenuItem>
}

function ItemContent({ item }: { item: Action }) {
  return (
    <>
      {item.leading ?? (item.icon === undefined ? null : <Icon name={item.icon} size={14} />)}
      <span className="iv-menu__label">{item.label}</span>
      {item.trailing}
      {item.hint === undefined ? null : <span className="iv-menu__hint">{item.hint}</span>}
      {item.checked === undefined ? null : (
        <span className="iv-menu__check">
          {item.checked ? <Icon name="check" size={14} /> : null}
        </span>
      )}
    </>
  )
}

function Items({ items }: { items: ReadonlyArray<CoreMenuItem> }) {
  const chosen = items.findIndex(
    (item) => typeof item === "object" && "checked" in item && item.checked,
  )
  return (
    <BaseMenu.RadioGroup value={chosen}>
      {items.map((item, index) => {
        if (item === "separator") {
          return <BaseMenu.Separator key={index} className="iv-menu__separator" />
        }
        if ("heading" in item) {
          return (
            <div key={index} className="iv-menu__heading" role="presentation">
              {item.heading}
            </div>
          )
        }
        const className =
          item.danger === true ? "iv-menu__item iv-menu__item--danger" : "iv-menu__item"
        return item.checked === undefined ? (
          <BaseMenu.Item
            key={index}
            className={className}
            disabled={item.disabled}
            aria-label={item["aria-label"]}
            onClick={item.onSelect}
          >
            <ItemContent item={item} />
          </BaseMenu.Item>
        ) : (
          <BaseMenu.RadioItem
            key={index}
            value={index}
            className={className}
            disabled={item.disabled}
            aria-label={item["aria-label"]}
            closeOnClick
            onClick={item.onSelect}
          >
            <ItemContent item={item} />
          </BaseMenu.RadioItem>
        )
      })}
    </BaseMenu.RadioGroup>
  )
}

export function Menu({ trigger, items, align = "start", onOpenChange }: CoreMenuProps) {
  return (
    <BaseMenu.Root {...(onOpenChange && { onOpenChange })}>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner align={align} sideOffset={4}>
          <BaseMenu.Popup className="iv-menu">
            <Items items={items} />
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}

// Opens at the pointer on a right click on `children`.
export function ContextMenu({
  items,
  children,
}: {
  items: ReadonlyArray<CoreMenuItem>
  children: ReactElement
}) {
  return (
    <BaseContextMenu.Root>
      <BaseContextMenu.Trigger render={children} />
      <BaseContextMenu.Portal>
        <BaseContextMenu.Positioner>
          <BaseContextMenu.Popup className="iv-menu">
            <Items items={items} />
          </BaseContextMenu.Popup>
        </BaseContextMenu.Positioner>
      </BaseContextMenu.Portal>
    </BaseContextMenu.Root>
  )
}
