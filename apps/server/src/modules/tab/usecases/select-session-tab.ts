import { Effect } from "effect"
import { TabStore } from "./tab-store.ts"
import { closeSubViewsOfOtherFolders, tabSubViews } from "./tab-sub-views.ts"

export const selectSessionTab = (sessionId: string) =>
  Effect.gen(function* () {
    yield* closeSubViewsOfOtherFolders(sessionId)
    const store = yield* TabStore
    const { fullWidth } = yield* store.layoutOf(sessionId)
    // Beside the chat there is no Session tab to select.
    yield* store.setLayout(sessionId, { fullWidth, sessionTabSelected: fullWidth })
    return yield* tabSubViews(sessionId)
  })
