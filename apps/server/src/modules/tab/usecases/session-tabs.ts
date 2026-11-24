import { Effect, Layer } from "effect"
import { SessionTabs } from "../../session/usecases/session-tabs.ts"
import { removeTab } from "./remove-tab.ts"
import { TabStore } from "./tab-store.ts"

export const layerSessionTabs = Layer.effect(SessionTabs)(
  Effect.gen(function* () {
    const tabs = yield* TabStore
    return {
      remove: (sessionId) =>
        removeTab(sessionId).pipe(Effect.asVoid, Effect.provideService(TabStore, tabs)),
      openSessionIds: (projectPath) =>
        tabs
          .listByProject(projectPath)
          .pipe(Effect.map((open) => open.map((tab) => tab.sessionId))),
    }
  }),
)
