import { lazy, type ReactElement, type ReactNode } from "react"
import { LazyPopup } from "../lazy-popup/lazy-popup.tsx"

export interface ColumnMenuItem {
  readonly value: string
  readonly label: string
  readonly description?: string | null
  readonly checked: boolean
  readonly disabled?: boolean
  readonly testId?: string
}

export interface ColumnMenuSection {
  readonly label?: string
  readonly items: ReadonlyArray<ColumnMenuItem>
}

export interface ColumnMenuColumn {
  readonly key: string
  readonly label: string
  readonly sections: ReadonlyArray<ColumnMenuSection>
  readonly wide?: boolean
  readonly note?: string
}

export interface ColumnMenuProps {
  readonly label: string
  readonly trigger: ReactElement
  readonly columns: ReadonlyArray<ColumnMenuColumn>
  readonly onPick: (column: string, value: string) => void
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly startColumn?: string
  readonly hint: string
  readonly children?: ReactNode
}

const loadColumnMenuPopup = () => import("./column-menu-popup.tsx")
const ColumnMenuPopup = lazy(loadColumnMenuPopup)

export function ColumnMenu(props: ColumnMenuProps) {
  return (
    <LazyPopup
      trigger={props.trigger}
      open={props.open}
      onOpenChange={props.onOpenChange}
      preload={loadColumnMenuPopup}
    >
      {() => <ColumnMenuPopup {...props} />}
    </LazyPopup>
  )
}

export function ColumnMenuNote({ children }: { children: ReactNode }) {
  return (
    <div className="iv-column-menu__wide-note" role="status">
      {children}
    </div>
  )
}
