import { DateTime, Effect } from "effect"
import { SessionStore } from "./session-store.ts"

const archivedAt = (session: { readonly archivedAt: DateTime.Utc | null }) =>
  session.archivedAt === null ? 0 : DateTime.toEpochMillis(session.archivedAt)

export const listArchivedSessions = (projectPath: string) =>
  Effect.gen(function* () {
    const sessions = yield* (yield* SessionStore).listByProject(projectPath)
    return sessions
      .filter((session) => session.archivedAt !== null)
      .toSorted((a, b) => archivedAt(b) - archivedAt(a))
  })
