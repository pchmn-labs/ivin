import { subViewKey, type SubView } from "@ivin/contracts/tab"
import { Effect } from "effect"
import { selectionAfterRemoval } from "../../../shared/rules/selection-after-removal.ts"
import { TabStore } from "./tab-store.ts"
import { closeSubViewsOfOtherFolders, tabSubViews } from "./tab-sub-views.ts"

export const closeSubView = (sessionId: string, subView: SubView) =>
  Effect.gen(function* () {
    yield* closeSubViewsOfOtherFolders(sessionId)
    const store = yield* TabStore
    const stored = yield* store.subViewsOf(sessionId)
    const removed = subViewKey(subView)
    const order = stored.map((entry) => subViewKey(entry.subView))
    if (order.includes(removed)) {
      const wasSelected = stored.some(
        (entry) => entry.selected && subViewKey(entry.subView) === removed,
      )
      yield* store.removeSubView(sessionId, subView)
      if (wasSelected) {
        const next = selectionAfterRemoval(order, removed)
        yield* store.selectSubView(
          sessionId,
          stored.find((entry) => subViewKey(entry.subView) === next)?.subView ?? null,
        )
      }
    }
    return yield* tabSubViews(sessionId)
  })
