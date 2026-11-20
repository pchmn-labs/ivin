import { Effect } from "effect"
import { SessionStore } from "./session-store.ts"

export const listSessions = (projectPath: string) =>
  Effect.gen(function* () {
    const sessions = yield* (yield* SessionStore).listByProject(projectPath)
    return sessions.filter((session) => session.archivedAt === null)
  })
