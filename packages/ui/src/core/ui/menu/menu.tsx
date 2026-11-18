import { Menu as BaseMenu } from "@base-ui/react/menu"
import type { MenuProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import "./menu.css"

export type { MenuProps }

export function Menu({ trigger, items, align = "start" }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner align={align} sideOffset={4}>
          <BaseMenu.Popup className="iv-menu">
            {items.map((item, index) =>
              item === "separator" ? (
                <BaseMenu.Separator key={index} className="iv-menu__separator" />
              ) : (
                <BaseMenu.Item
                  key={index}
                  className={
                    item.danger === true ? "iv-menu__item iv-menu__item--danger" : "iv-menu__item"
                  }
                  disabled={item.disabled}
                  onClick={item.onSelect}
                >
                  {item.icon === undefined ? null : <Icon name={item.icon} size={14} />}
                  {item.label}
                </BaseMenu.Item>
              ),
            )}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}
