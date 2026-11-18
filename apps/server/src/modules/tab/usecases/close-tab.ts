import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { selectionAfterRemoval } from "../../../shared/rules/selection-after-removal.ts"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { stopAgentOnTabClose } from "../../session/usecases/stop-agent-on-tab-close.ts"
import { listTabs } from "./list-tabs.ts"
import { TabStore } from "./tab-store.ts"

export const closeTab = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* TabStore
    const tab = yield* store.find(sessionId)
    if (!tab) {
      const session = yield* (yield* SessionStore).findById(sessionId)
      if (!session) return yield* new SessionNotFound({ sessionId })
      return yield* listTabs(session.projectPath)
    }
    const before = yield* listTabs(tab.projectPath)
    yield* store.remove(sessionId)
    if (before.selectedSessionId === sessionId) {
      const order = before.tabs.map((tab) => tab.sessionId)
      yield* store.select(tab.projectPath, selectionAfterRemoval(order, sessionId))
    }
    yield* stopAgentOnTabClose([sessionId])
    return yield* listTabs(tab.projectPath)
  })
