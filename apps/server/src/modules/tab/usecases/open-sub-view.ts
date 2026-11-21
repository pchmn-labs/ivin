import type { SubView } from "@ivin/contracts/tab"
import { Effect } from "effect"
import { pruneSubViews, readSubViews } from "./sub-views-of.ts"

export const openSubView = (sessionId: string, subView: SubView) =>
  Effect.gen(function* () {
    const { session, store } = yield* pruneSubViews(sessionId)
    const open = (yield* store.subViewsOf(sessionId)).some(
      (entry) => entry.subView.kind === subView.kind && entry.subView.path === subView.path,
    )
    if (!open) yield* store.appendSubView(sessionId, subView, session.workingFolder)
    yield* store.selectSubView(sessionId, subView)
    return yield* readSubViews(sessionId)
  })
