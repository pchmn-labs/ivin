import { Effect } from "effect"
import { closeSubViewsOfOtherFolders, tabSubViews } from "./tab-sub-views.ts"

export const listSubViews = (sessionId: string) =>
  Effect.gen(function* () {
    yield* closeSubViewsOfOtherFolders(sessionId)
    return yield* tabSubViews(sessionId)
  })
