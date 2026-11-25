import type { SubView } from "@ivin/contracts/tab"
import type { ViewPlacement } from "@ivin/plugin-api/ui"
import { Effect } from "effect"
import { serverRuntime } from "../../../core/server-client.ts"
import { closeSubView } from "../../tab/atoms/close-sub-view.ts"
import { openSubView } from "../../tab/atoms/open-sub-view.ts"
import { withSheetViewClosed, withSheetViewOpen } from "../rules/overlay-views.ts"
import { dialogViewOf, sheetViewsOf } from "./overlay-views.ts"

export interface MoveView {
  readonly sessionId: string
  readonly workingFolder: string
  readonly view: SubView
  readonly from: ViewPlacement
  readonly to: ViewPlacement
}

export const moveViewAtom = serverRuntime.fn<MoveView>()(
  Effect.fnUntraced(function* ({ sessionId, workingFolder, view, from, to }, get) {
    const registry = get.registry
    const sheet = sheetViewsOf(sessionId, workingFolder)
    const dialog = dialogViewOf(sessionId, workingFolder)
    const sheetBefore = registry.get(sheet)
    const dialogBefore = registry.get(dialog)
    if (from === "subView") yield* closeSubView(sessionId, workingFolder, view)
    else if (from === "sheet") registry.set(sheet, withSheetViewClosed(sheetBefore, view))
    else registry.set(dialog, null)

    if (to === "sheet") registry.set(sheet, withSheetViewOpen(registry.get(sheet), view))
    else if (to === "dialog") registry.set(dialog, view)
    // Only a sub-view can fail to open, and only after a sheet or dialog view closed: it goes back.
    else
      yield* openSubView(sessionId, workingFolder, view).pipe(
        Effect.onError(() =>
          Effect.sync(() => {
            registry.set(sheet, sheetBefore)
            registry.set(dialog, dialogBefore)
          }),
        ),
      )
    return undefined
  }),
)
