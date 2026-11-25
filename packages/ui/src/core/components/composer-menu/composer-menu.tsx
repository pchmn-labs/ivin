import { lazy, type ComponentType, type ReactElement, type ReactNode } from "react"
import type { IconName } from "../icon/icon.tsx"
import { LazyPopup, type OpenedBy } from "../lazy-popup/lazy-popup.tsx"

export interface ComposerMenuItem<T> {
  readonly value: T
  readonly key: string
  readonly label: string
  readonly prefix?: string
  readonly icon?: IconName
  readonly accent?: boolean
  readonly muted?: boolean
  readonly mono?: boolean
  readonly tag?: string
  readonly hint?: string
  readonly checked?: boolean
  readonly testId?: string
}

export function ComposerMenuNote({ children }: { children: ReactNode }) {
  return (
    <div className="iv-composer-menu__note" role="status">
      {children}
    </div>
  )
}

export interface ComposerMenuGroup<T> {
  readonly label?: string
  readonly items: ReadonlyArray<ComposerMenuItem<T>>
}

export interface ComposerMenuProps<T> {
  readonly label: string
  readonly trigger: ReactElement
  readonly groups: ReadonlyArray<ComposerMenuGroup<T>>
  readonly onPick: (value: T) => void
  readonly searchPlaceholder: string
  readonly noMatch: (query: string) => string
  readonly disabled?: boolean
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly keepOpenOnPick?: boolean
  readonly onHighlight?: (value: T | undefined) => void
  readonly checkedLabel?: string
  readonly searchStatus?: ReactNode
  readonly status?: (query: string) => ReactNode
  readonly children?: ReactNode
}

const loadComposerMenuPopup = () => import("./composer-menu-popup.tsx")
// `lazy` drops the generic: the popup is typed for `unknown` values here.
const ComposerMenuPopup = lazy(loadComposerMenuPopup) as unknown as ComponentType<
  ComposerMenuProps<unknown> & { openedBy: OpenedBy | undefined }
>

export function ComposerMenu<T>(props: ComposerMenuProps<T>) {
  return (
    <LazyPopup
      trigger={props.trigger}
      disabled={props.disabled}
      open={props.open}
      onOpenChange={props.onOpenChange}
      preload={loadComposerMenuPopup}
      haspopup="listbox"
      role="combobox"
    >
      {(openedBy) => (
        <ComposerMenuPopup {...(props as ComposerMenuProps<unknown>)} openedBy={openedBy} />
      )}
    </LazyPopup>
  )
}
