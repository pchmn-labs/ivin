import { Effect } from "effect"
import { reorder } from "../rules/reorder.ts"
import { listTabs } from "./list-tabs.ts"
import { TabStore } from "./tab-store.ts"

export const reorderTabs = (projectPath: string, sessionIds: readonly string[]) =>
  Effect.gen(function* () {
    const store = yield* TabStore
    const current = yield* store.listByProject(projectPath)
    yield* store.setOrder(
      projectPath,
      reorder(
        current.map((tab) => tab.sessionId),
        sessionIds,
      ),
    )
    return yield* listTabs(projectPath)
  })
