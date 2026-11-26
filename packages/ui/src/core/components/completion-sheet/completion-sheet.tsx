import type { CompletionItem } from "@ivin/plugin-api/ui"
import { lazy, type ReactNode } from "react"
import { LazyOnOpen } from "../lazy-on-open/lazy-on-open.tsx"

export interface CompletionSheetProps {
  readonly open: boolean
  readonly listId: string
  readonly trigger: string
  readonly title: string
  readonly items: ReadonlyArray<CompletionItem>
  readonly active: number
  // In place of the items: a message of the caller's, or what shows when none matches.
  readonly message: ReactNode
  readonly onHover: (index: number) => void
  readonly onPick: (item: CompletionItem) => void
}

export const completionOptionId = (listId: string, index: number) => `${listId}-${index}`

const CompletionSheetList = lazy(() => import("./completion-sheet-list.tsx"))

export function CompletionSheet(props: CompletionSheetProps) {
  return (
    <LazyOnOpen open={props.open}>{props.open && <CompletionSheetList {...props} />}</LazyOnOpen>
  )
}
