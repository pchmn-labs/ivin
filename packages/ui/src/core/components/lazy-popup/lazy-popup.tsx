import {
  Suspense,
  cloneElement,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react"

interface TriggerProps {
  onClick?: (event: MouseEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onPointerEnter?: (event: unknown) => void
  onFocus?: (event: unknown) => void
}

export type OpenedBy = "pointer" | "keyboard"

// The popup's code loads at the first hover, focus or click on the trigger, and opens as it mounts.
export function LazyPopup({
  trigger,
  disabled,
  open,
  onOpenChange,
  preload,
  haspopup,
  role,
  children,
}: {
  readonly trigger: ReactElement
  readonly disabled?: boolean | undefined
  // A popup its owner holds open mounts as soon as it is told to open.
  readonly open?: boolean | undefined
  readonly onOpenChange?: ((open: boolean) => void) | undefined
  readonly preload: () => Promise<unknown>
  readonly haspopup: "menu" | "listbox" | "dialog"
  readonly role?: string
  readonly children: (openedBy: OpenedBy | undefined) => ReactNode
}) {
  const [mounted, setMounted] = useState(open === true)
  const [waiting, setWaiting] = useState(false)
  const [openedBy, setOpenedBy] = useState<OpenedBy | undefined>()
  if (open === true && !mounted) setMounted(true)

  const want = (by: OpenedBy) => {
    setMounted(true)
    setWaiting(true)
    if (open === undefined) setOpenedBy(by)
    onOpenChange?.(true)
  }
  const own = trigger.props as TriggerProps
  const pending = cloneElement(trigger as ReactElement<Record<string, unknown>>, {
    ...(disabled === true && { disabled: true }),
    ...(role !== undefined && { role }),
    "aria-haspopup": haspopup,
    ...(waiting && { "aria-busy": true }),
    "aria-expanded": false,
    onPointerEnter: (event: unknown) => {
      own.onPointerEnter?.(event)
      void preload()
    },
    onFocus: (event: unknown) => {
      own.onFocus?.(event)
      void preload()
    },
    onClick: (event: MouseEvent) => {
      own.onClick?.(event)
      if (disabled !== true) want(event.detail === 0 ? "keyboard" : "pointer")
    },
    onKeyDown: (event: KeyboardEvent) => {
      own.onKeyDown?.(event)
      // A popover opens by click only.
      if (event.key !== "ArrowDown" || haspopup === "dialog" || disabled === true) return
      event.preventDefault()
      want("keyboard")
    },
  })

  return mounted ? <Suspense fallback={pending}>{children(openedBy)}</Suspense> : pending
}
