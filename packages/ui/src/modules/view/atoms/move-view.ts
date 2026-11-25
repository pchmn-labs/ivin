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

// Closes the view where it is, then opens it with the same params in `to`.
export const moveViewAtom = serverRuntime.fn<MoveView>()(
  Effect.fnUntraced(function* ({ sessionId, workingFolder, view, from, to }, get) {
    const registry = get.registry
    const sheet = sheetViewsOf(sessionId, workingFolder)
    const dialog = dialogViewOf(sessionId, workingFolder)
    if (from === "subView") yield* closeSubView(sessionId, workingFolder, view)
    else if (from === "sheet") registry.set(sheet, withSheetViewClosed(registry.get(sheet), view))
    else registry.set(dialog, null)

    if (to === "subView") yield* openSubView(sessionId, workingFolder, view)
    else if (to === "sheet") registry.set(sheet, withSheetViewOpen(registry.get(sheet), view))
    else registry.set(dialog, view)
    return undefined
  }),
)
