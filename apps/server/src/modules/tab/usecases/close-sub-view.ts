import type { SubView } from "@ivin/contracts/tab"
import { Effect } from "effect"
import { selectionAfterRemoval } from "../../../shared/rules/selection-after-removal.ts"
import { pruneSubViews, readSubViews } from "./sub-views-of.ts"

const keyOf = (subView: SubView) => `${subView.kind}:${subView.path}`

export const closeSubView = (sessionId: string, subView: SubView) =>
  Effect.gen(function* () {
    const { store } = yield* pruneSubViews(sessionId)
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
    return yield* readSubViews(sessionId)
  })
