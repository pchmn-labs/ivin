import { Effect } from "effect"
import { selectionAfterRemoval } from "../../../shared/rules/selection-after-removal.ts"
import { TabStore } from "./tab-store.ts"

// Returns the removed tab, or null when the session had none.
export const removeTab = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* TabStore
    const tab = yield* store.find(sessionId)
    if (!tab) return null
    const order = (yield* store.listByProject(tab.projectPath)).map((tab) => tab.sessionId)
    const selected = yield* store.selectedOf(tab.projectPath)
    yield* store.remove(sessionId)
    if (selected === sessionId) {
      yield* store.select(tab.projectPath, selectionAfterRemoval(order, sessionId))
    }
    return tab
  })
