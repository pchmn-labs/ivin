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

// Keeps a popup's code out of the main chunk: the trigger is drawn as it is, the popup's own
// element (`children`) loads at the first hover, focus or click on it, and opens as it mounts.
export function LazyPopup({
  trigger,
  disabled,
  open,
  onOpenChange,
  preload,
  role,
  children,
}: {
  readonly trigger: ReactElement
  readonly disabled?: boolean | undefined
  // A popup its owner holds open mounts as soon as it is told to open.
  readonly open?: boolean | undefined
  readonly onOpenChange?: ((open: boolean) => void) | undefined
  readonly preload: () => Promise<unknown>
  // What the real trigger would carry before it opens.
  readonly role?: string
  // `openedBy` is set when the popup mounts because the user asked to open it and its owner holds no `open`.
  readonly children: (openedBy: OpenedBy | undefined) => ReactNode
}) {
  const [mounted, setMounted] = useState(open === true)
  const [openedBy, setOpenedBy] = useState<OpenedBy | undefined>()
  if (open === true && !mounted) setMounted(true)

  const want = (by: OpenedBy) => {
    setMounted(true)
    if (open === undefined) setOpenedBy(by)
    onOpenChange?.(true)
  }
  const own = trigger.props as TriggerProps
  const pending = cloneElement(trigger as ReactElement<Record<string, unknown>>, {
    ...(disabled === true && { disabled: true }),
    ...(role !== undefined && { role }),
    "aria-haspopup": role === "combobox" ? "listbox" : "true",
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
      if (event.key !== "ArrowDown" || disabled === true) return
      event.preventDefault()
      want("keyboard")
    },
  })

  return mounted ? <Suspense fallback={pending}>{children(openedBy)}</Suspense> : pending
}
