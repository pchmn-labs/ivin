import type { SubView } from "@ivin/contracts/tab"
import { Effect } from "effect"
import { TabStore } from "./tab-store.ts"
import { closeSubViewsOfOtherFolders, tabSubViews } from "./tab-sub-views.ts"

export const openSubView = (sessionId: string, subView: SubView) =>
  Effect.gen(function* () {
    const session = yield* closeSubViewsOfOtherFolders(sessionId)
    const store = yield* TabStore
    const open = (yield* store.subViewsOf(sessionId)).some(
      (entry) => entry.subView.kind === subView.kind && entry.subView.path === subView.path,
    )
    if (!open) yield* store.appendSubView(sessionId, subView, session.workingFolder)
    yield* store.selectSubView(sessionId, subView)
    return yield* tabSubViews(sessionId)
  })
