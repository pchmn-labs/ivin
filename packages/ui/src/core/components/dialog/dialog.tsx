import type { DialogProps } from "@ivin/plugin-api/ui"
import { lazy } from "react"
import { LazyOnOpen } from "../lazy-popup/lazy-on-open.tsx"

export type { DialogProps }

const DialogPopup = lazy(() => import("./dialog-popup.tsx"))

export function Dialog(props: DialogProps) {
  return (
    <LazyOnOpen open={props.open}>
      <DialogPopup {...props} />
    </LazyOnOpen>
  )
}
