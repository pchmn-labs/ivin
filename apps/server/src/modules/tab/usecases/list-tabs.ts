import { Effect } from "effect"
import { checkWorkingFolders } from "../../session/usecases/check-working-folder.ts"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { TabStore } from "./tab-store.ts"

export const listTabs = (projectPath: string) =>
  Effect.gen(function* () {
    const store = yield* TabStore
    const tabs = yield* store.listByProject(projectPath)
    const shown = new Set(tabs.map((tab) => tab.sessionId))
    const sessions = yield* (yield* SessionStore).listByProject(projectPath)
    // Tabs restored at launch never go through tab.open, where a session is checked otherwise.
    yield* checkWorkingFolders(
      projectPath,
      sessions.filter((session) => shown.has(session.id)),
    )
    return {
      projectPath,
      tabs,
      selectedSessionId: yield* store.selectedOf(projectPath),
    }
  })
