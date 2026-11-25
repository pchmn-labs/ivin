import { Dialog } from "@base-ui/react/dialog"
import { ContextMenu, Menu, type CoreMenuItem } from "../../src/core/components/menu/menu.tsx"
import { Tooltip } from "../../src/core/components/tooltip/tooltip.tsx"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { PlacementIcon } from "./placement-icon.tsx"
import { PLACEMENT_LABEL, type MoveProps, type Variant } from "./scene.tsx"

const KEY = "⇧⌘O"

const moveItems = ({ targets, move }: MoveProps): CoreMenuItem[] => [
  { heading: "Move to" },
  ...targets.map((to) => ({
    label: PLACEMENT_LABEL[to],
    leading: <PlacementIcon name={to} />,
    onSelect: () => move(to),
  })),
]

const triggerKey = (props: MoveProps) => `${props.view.id}@${props.from}`

const openByKeyboard = (selector: string) => () => {
  const trigger = document.querySelector<HTMLElement>(selector)
  if (trigger === null) return
  trigger.focus()
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }))
}

// 1. A "⋯" button in every frame's head, whose menu starts with "Move to".
function OverflowControl(props: MoveProps) {
  const key = triggerKey(props)
  props.registerOpener(openByKeyboard(`[data-move-trigger="${CSS.escape(key)}"]`))
  return (
    <Menu
      align="end"
      items={[
        ...moveItems(props),
        "separator",
        { label: "Close", icon: "x", hint: props.from === "subView" ? "⇧⌘W" : "Esc", onSelect: props.close },
      ]}
      trigger={
        <button
          type="button"
          className="iv-button iv-button--icon iv-button--ghost iv-button--sm"
          aria-label={`View options (${KEY})`}
          title={`View options (${KEY})`}
          data-move-trigger={key}
        >
          <Icon name="ellipsis" size={14} />
        </button>
      }
    />
  )
}

export const Overflow: Variant = { HeadControl: OverflowControl, keyHint: KEY }

// 2. No new button: the tab's own right-click menu, and the dialog's title as a menu button.
function TabMenu(props: MoveProps & { children: React.ReactNode; selected: boolean }) {
  const key = triggerKey(props)
  props.registerOpener(() => {
    const tab = document.querySelector<HTMLElement>(`[data-tab-menu="${CSS.escape(key)}"]`)
    if (tab === null) return
    const box = tab.getBoundingClientRect()
    tab.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: box.left + 8, clientY: box.bottom }),
    )
  })
  return (
    <ContextMenu
      items={[
        ...moveItems(props),
        "separator",
        { label: "Close", icon: "x", onSelect: props.close },
      ]}
    >
      <div className="proto-tab-menu" data-tab-menu={key}>
        {props.children}
      </div>
    </ContextMenu>
  )
}

function TitleMenu(props: MoveProps) {
  const key = triggerKey(props)
  props.registerOpener(openByKeyboard(`[data-move-trigger="${CSS.escape(key)}"]`))
  return (
    <Dialog.Title render={<div />} className="iv-dialog__title">
      <Menu
        items={moveItems(props)}
        trigger={
          <button type="button" className="proto-title-button" data-move-trigger={key} data-view-dialog={props.view.id}>
            {props.view.title}
            <Icon name="chevron-down" size={14} />
          </button>
        }
      />
    </Dialog.Title>
  )
}

export const TabMenus: Variant = { TabWrapper: TabMenu, DialogTitle: TitleMenu, keyHint: KEY }

// 3. One button per other placement, no menu; the key moves to the next placement.
function DirectControl(props: MoveProps) {
  return (
    <span className="proto-direct">
      {props.targets.map((to) => (
        <Tooltip key={to} content={`Move to ${PLACEMENT_LABEL[to]}`}>
          <button
            type="button"
            className="iv-button iv-button--icon iv-button--ghost iv-button--sm"
            aria-label={`Move to ${PLACEMENT_LABEL[to]}`}
            onClick={() => props.move(to)}
          >
            <PlacementIcon name={to} />
          </button>
        </Tooltip>
      ))}
    </span>
  )
}

export const Direct: Variant = {
  HeadControl: DirectControl,
  onCommand: (props) => {
    const order = props.view.placements
    const next = order[(order.indexOf(props.from) + 1) % order.length]
    if (next !== undefined && next !== props.from) props.move(next)
  },
  keyHint: KEY,
}
