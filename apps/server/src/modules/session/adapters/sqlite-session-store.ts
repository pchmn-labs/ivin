import type { Session, SessionStatus } from "@ivin/contracts/session"
import { DateTime, Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { SessionStore } from "../usecases/session-store.ts"

interface SessionRow {
  id: string
  project_path: string
  working_folder: string
  branch: string | null
  started: number
  title: string
  model: string
  status: SessionStatus
  status_changed_at: number
  created_at: number
  last_activity_at: number
}

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  projectPath: row.project_path,
  workingFolder: row.working_folder,
  inWorktree: row.working_folder !== row.project_path,
  branch: row.branch,
  started: row.started === 1,
  title: row.title,
  model: row.model,
  status: row.status,
  statusChangedAt: DateTime.makeUnsafe(row.status_changed_at),
  createdAt: DateTime.makeUnsafe(row.created_at),
  lastActivityAt: DateTime.makeUnsafe(row.last_activity_at),
})

const columns = `id, project_path, working_folder, branch, title, model, status, status_changed_at,
  created_at, last_activity_at, EXISTS (
    SELECT 1 FROM transcript_events e WHERE e.session_id = sessions.id AND e.type = 'user_message'
  ) AS started`

export const layerSqliteSessionStore = Layer.effect(SessionStore)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      insert: (session) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO sessions (id, project_path, working_folder, branch, title, model, status,
               status_changed_at, created_at, last_activity_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            session.id,
            session.projectPath,
            session.workingFolder,
            session.branch,
            session.title,
            session.model,
            session.status,
            DateTime.toEpochMillis(session.statusChangedAt),
            DateTime.toEpochMillis(session.createdAt),
            DateTime.toEpochMillis(session.lastActivityAt),
          )
        }),
      findById: (id) =>
        Effect.sync(() => {
          const row = db.prepare(`SELECT ${columns} FROM sessions WHERE id = ?`).get(id) as
            | SessionRow
            | undefined
          return row ? toSession(row) : null
        }),
      listByProject: (projectPath) =>
        Effect.sync(() =>
          (
            db
              .prepare(
                `SELECT ${columns} FROM sessions WHERE project_path = ?
                 ORDER BY last_activity_at DESC, created_at DESC`,
              )
              .all(projectPath) as unknown as SessionRow[]
          ).map(toSession),
        ),
      rename: (id, title) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET title = ?, title_locked = 1 WHERE id = ?").run(title, id)
        }),
      setTitleIfUnset: (id, title) =>
        Effect.sync(() => {
          db.prepare(
            "UPDATE sessions SET title = ?, title_locked = 1 WHERE id = ? AND title_locked = 0",
          ).run(title, id)
        }),
      providerSessionId: (id) =>
        Effect.sync(() => {
          const row = db
            .prepare("SELECT provider_session_id FROM sessions WHERE id = ?")
            .get(id) as { provider_session_id: string | null } | undefined
          return row?.provider_session_id ?? null
        }),
      setProviderSessionId: (id, providerSessionId) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET provider_session_id = ? WHERE id = ?").run(
            providerSessionId,
            id,
          )
        }),
      setWorkingFolder: (id, workingFolder, branch) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET working_folder = ?, branch = ? WHERE id = ?").run(
            workingFolder,
            branch,
            id,
          )
        }),
      setStatus: (id, status, at) =>
        Effect.sync(() => {
          db.prepare(
            `UPDATE sessions SET status = ?, status_changed_at = ?
             WHERE id = ? AND status <> ?`,
          ).run(status, DateTime.toEpochMillis(at), id, status)
        }),
      resetRunning: Effect.sync(() => {
        db.prepare(
          `UPDATE sessions SET status = 'idle', status_changed_at = last_activity_at
           WHERE status NOT IN ('idle', 'failed')`,
        ).run()
      }),
      touch: (id, at) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET last_activity_at = ? WHERE id = ?").run(
            DateTime.toEpochMillis(at),
            id,
          )
        }),
    }
  }),
)
