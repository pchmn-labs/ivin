import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { afterTabsClosed } from "./after-tabs-closed.ts"
import { listTabs } from "./list-tabs.ts"
import { removeTab } from "./remove-tab.ts"

export const closeTab = (sessionId: string) =>
  Effect.gen(function* () {
    const tab = yield* removeTab(sessionId)
    if (!tab) {
      const session = yield* (yield* SessionStore).findById(sessionId)
      if (!session) return yield* new SessionNotFound({ sessionId })
      return yield* listTabs(session.projectPath)
    }
    yield* afterTabsClosed(tab.projectPath, [sessionId])
    return yield* listTabs(tab.projectPath)
  })
