import { ProjectNotOpen } from "@ivin/contracts/project"
import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { listTabs } from "./list-tabs.ts"
import { TabStore } from "./tab-store.ts"

export const openTab = (sessionId: string) =>
  Effect.gen(function* () {
    const sessions = yield* SessionStore
    const store = yield* TabStore
    const session = yield* sessions.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    const { projectPath } = session
    if (!(yield* store.isProjectOpen(projectPath))) {
      return yield* new ProjectNotOpen({ path: projectPath })
    }
    if (!(yield* store.find(sessionId))) yield* store.append({ sessionId, projectPath })
    yield* store.select(projectPath, sessionId)
    return yield* listTabs(projectPath)
  })
