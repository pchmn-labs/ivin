import type { QuickPickProps } from "@ivin/plugin-api/ui"
import { lazy } from "react"
import { LazyOnOpen } from "../lazy-popup/lazy-on-open.tsx"

export type { QuickPickProps }

const QuickPickPopup = lazy(() => import("./quick-pick-popup.tsx"))

export function QuickPick(props: QuickPickProps) {
  return (
    <LazyOnOpen open={props.open}>
      <QuickPickPopup {...props} />
    </LazyOnOpen>
  )
}
