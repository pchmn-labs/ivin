import type { MenuItem, MenuProps } from "@ivin/plugin-api/ui"
import {
  Suspense,
  cloneElement,
  lazy,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react"
import { LazyPopup } from "../lazy-popup/lazy-popup.tsx"

export type { MenuProps }

export type CoreMenuAction = Exclude<MenuItem, "separator" | { readonly heading: string }> & {
  // In place of the icon.
  readonly leading?: ReactNode
  readonly trailing?: ReactNode
  readonly "aria-label"?: string
}

export type CoreMenuItem = CoreMenuAction | "separator" | { readonly heading: string }

export interface CoreMenuProps extends Omit<MenuProps, "items"> {
  readonly items: ReadonlyArray<CoreMenuItem>
}

const loadMenuPopup = () => import("./menu-popup.tsx")
const MenuPopup = lazy(() => loadMenuPopup().then((m) => ({ default: m.MenuPopup })))
const ContextMenuPopup = lazy(() => loadMenuPopup().then((m) => ({ default: m.ContextMenuPopup })))

export function Menu(props: CoreMenuProps) {
  return (
    <LazyPopup
      trigger={props.trigger}
      onOpenChange={props.onOpenChange}
      preload={loadMenuPopup}
      haspopup="menu"
    >
      {(openedBy) => <MenuPopup {...props} openedBy={openedBy} />}
    </LazyPopup>
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
  const [asked, setAsked] = useState<{ readonly x: number; readonly y: number } | undefined>()
  const [mounted, setMounted] = useState(false)
  const own = children.props as {
    onContextMenu?: (event: MouseEvent) => void
    onPointerEnter?: (event: unknown) => void
  }
  const pending = cloneElement(children as ReactElement<Record<string, unknown>>, {
    onPointerEnter: (event: unknown) => {
      own.onPointerEnter?.(event)
      void loadMenuPopup()
    },
    onContextMenu: (event: MouseEvent) => {
      own.onContextMenu?.(event)
      event.preventDefault()
      setAsked({ x: event.clientX, y: event.clientY })
      setMounted(true)
    },
  })
  return mounted ? (
    <Suspense fallback={pending}>
      <ContextMenuPopup items={items} openAt={asked}>
        {children}
      </ContextMenuPopup>
    </Suspense>
  ) : (
    pending
  )
}
