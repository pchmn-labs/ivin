import { sameSubView, type SubView } from "@ivin/contracts/tab"
import { Effect } from "effect"
import { TabStore } from "./tab-store.ts"
import { closeSubViewsOfOtherFolders, tabSubViews } from "./tab-sub-views.ts"

export const openSubView = (sessionId: string, subView: SubView) =>
  Effect.gen(function* () {
    const session = yield* closeSubViewsOfOtherFolders(sessionId)
    const store = yield* TabStore
    const open = (yield* store.subViewsOf(sessionId)).some((entry) =>
      sameSubView(entry.subView, subView),
    )
    if (!open) yield* store.appendSubView(sessionId, subView, session.workingFolder)
    yield* store.selectSubView(sessionId, subView)
    const { fullWidth } = yield* store.layoutOf(sessionId)
    yield* store.setLayout(sessionId, { fullWidth, sessionTabSelected: false })
    return yield* tabSubViews(sessionId)
  })
