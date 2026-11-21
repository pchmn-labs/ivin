import type { SubView } from "@ivin/contracts/tab"
import { Effect } from "effect"
import { selectionAfterRemoval } from "../../../shared/rules/selection-after-removal.ts"
import { TabStore } from "./tab-store.ts"
import { closeSubViewsOfOtherFolders, tabSubViews } from "./tab-sub-views.ts"

const keyOf = (subView: SubView) => `${subView.kind}:${subView.path}`

export const closeSubView = (sessionId: string, subView: SubView) =>
  Effect.gen(function* () {
    yield* closeSubViewsOfOtherFolders(sessionId)
    const store = yield* TabStore
    const stored = yield* store.subViewsOf(sessionId)
    const removed = keyOf(subView)
    const order = stored.map((entry) => keyOf(entry.subView))
    if (order.includes(removed)) {
      const wasSelected = stored.some((entry) => entry.selected && keyOf(entry.subView) === removed)
      yield* store.removeSubView(sessionId, subView)
      if (wasSelected) {
        const next = selectionAfterRemoval(order, removed)
        yield* store.selectSubView(
          sessionId,
          stored.find((entry) => keyOf(entry.subView) === next)?.subView ?? null,
        )
      }
    }
    return yield* tabSubViews(sessionId)
  })
