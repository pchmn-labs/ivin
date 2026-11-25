import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu"
import { Menu as BaseMenu } from "@base-ui/react/menu"
import { useEffect, useRef, type ReactElement } from "react"
import { Icon } from "../icon/icon.tsx"
import type { OpenedBy } from "../lazy-popup/lazy-popup.tsx"
import type { CoreMenuAction, CoreMenuItem, CoreMenuProps } from "./menu.tsx"
import "./menu.css"

function ItemContent({ item }: { item: CoreMenuAction }) {
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

export function MenuPopup({
  trigger,
  items,
  align = "start",
  onOpenChange,
  openedBy,
}: CoreMenuProps & { openedBy: OpenedBy | undefined }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // Only a keydown on the trigger makes the menu highlight its first item.
    if (openedBy !== "keyboard") return
    triggerRef.current?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    )
  }, [openedBy])
  return (
    <BaseMenu.Root defaultOpen={openedBy === "pointer"} {...(onOpenChange && { onOpenChange })}>
      <BaseMenu.Trigger ref={triggerRef} render={trigger} />
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

export function ContextMenuPopup({
  items,
  children,
  openAt,
}: {
  items: ReadonlyArray<CoreMenuItem>
  children: ReactElement
  openAt: { readonly x: number; readonly y: number } | undefined
}) {
  const trigger = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (openAt === undefined) return
    trigger.current?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: openAt.x,
        clientY: openAt.y,
      }),
    )
  }, [openAt])
  return (
    <BaseContextMenu.Root>
      <BaseContextMenu.Trigger ref={trigger} render={children} />
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
