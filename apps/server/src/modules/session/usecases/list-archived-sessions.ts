import { DateTime, Effect } from "effect"
import { SessionStore } from "./session-store.ts"

export const listArchivedSessions = (projectPath: string) =>
  Effect.gen(function* () {
    const sessions = yield* (yield* SessionStore).listByProject(projectPath)
    return sessions
      .flatMap((session) =>
        session.archivedAt === null ? [] : [{ session, at: session.archivedAt }],
      )
      .toSorted((a, b) => DateTime.toEpochMillis(b.at) - DateTime.toEpochMillis(a.at))
      .map(({ session }) => session)
  })
