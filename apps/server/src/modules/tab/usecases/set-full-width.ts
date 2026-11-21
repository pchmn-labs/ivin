import { Effect } from "effect"
import { TabStore } from "./tab-store.ts"
import { closeSubViewsOfOtherFolders, tabSubViews } from "./tab-sub-views.ts"

export const setFullWidth = (sessionId: string, fullWidth: boolean) =>
  Effect.gen(function* () {
    yield* closeSubViewsOfOtherFolders(sessionId)
    const store = yield* TabStore
    const { sessionTabSelected } = yield* store.layoutOf(sessionId)
    yield* store.setLayout(sessionId, {
      fullWidth,
      sessionTabSelected: fullWidth && sessionTabSelected,
    })
    return yield* tabSubViews(sessionId)
  })
