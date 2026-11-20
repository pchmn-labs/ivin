import type {
  Harness,
  RelaunchFailure,
  RunOptions,
  Session,
  SessionStatus,
} from "@ivin/contracts/session"
import { DateTime, Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { SessionStore } from "../usecases/session-store.ts"

interface SessionRow {
  id: string
  project_path: string
  working_folder: string
  branch: string | null
  started: number
  working_folder_deleted: number
  title: string
  harness: Harness
  model: string
  effort: string
  permission_mode: string
  relaunch_failure: string | null
  status: SessionStatus
  status_changed_at: number
  created_at: number
  last_activity_at: number
  archived_at: number | null
  last_image_number: number
}

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  projectPath: row.project_path,
  workingFolder: row.working_folder,
  inWorktree: row.working_folder !== row.project_path,
  branch: row.branch,
  started: row.started === 1,
  workingFolderDeleted: row.working_folder_deleted === 1,
  title: row.title,
  harness: row.harness,
  model: row.model,
  effort: row.effort,
  permissionMode: row.permission_mode,
  relaunchFailure:
    row.relaunch_failure === null
      ? null
      : // Stored before the agent's error was kept.
        { error: null, ...(JSON.parse(row.relaunch_failure) as Omit<RelaunchFailure, "error">) },
  status: row.status,
  statusChangedAt: DateTime.makeUnsafe(row.status_changed_at),
  createdAt: DateTime.makeUnsafe(row.created_at),
  lastActivityAt: DateTime.makeUnsafe(row.last_activity_at),
  archivedAt: row.archived_at === null ? null : DateTime.makeUnsafe(row.archived_at),
  lastImageNumber: row.last_image_number,
})

const columns = `id, project_path, working_folder, working_folder_deleted, branch, title, harness, model,
  effort, permission_mode, relaunch_failure, status,
  status_changed_at, created_at, last_activity_at, archived_at, EXISTS (
    SELECT 1 FROM transcript_events e WHERE e.session_id = sessions.id AND e.type = 'user_message'
  ) AS started,
  (SELECT COALESCE(MAX(number), 0) FROM images i WHERE i.session_id = sessions.id) AS last_image_number`

export const layerSqliteSessionStore = Layer.effect(SessionStore)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      insert: (session) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO sessions (id, project_path, working_folder, branch, title, harness, model,
               effort, permission_mode, run_options_at, status, status_changed_at, created_at,
               last_activity_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            session.id,
            session.projectPath,
            session.workingFolder,
            session.branch,
            session.title,
            session.harness,
            session.model,
            session.effort,
            session.permissionMode,
            DateTime.toEpochMillis(session.createdAt),
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
      setRunOptions: (id, { model, effort, permissionMode }, at) =>
        Effect.sync(() => {
          db.prepare(
            `UPDATE sessions SET model = ?, effort = ?, permission_mode = ?, run_options_at = ?
             WHERE id = ?`,
          ).run(model, effort, permissionMode, DateTime.toEpochMillis(at), id)
        }),
      lastRunOptions: (projectPath) =>
        Effect.sync(() => {
          const row = db
            .prepare(
              `SELECT model, effort, permission_mode FROM sessions WHERE project_path = ?
               ORDER BY run_options_at DESC, rowid DESC LIMIT 1`,
            )
            .get(projectPath) as
            | { model: string; effort: string; permission_mode: string }
            | undefined
          return row
            ? { model: row.model, effort: row.effort, permissionMode: row.permission_mode }
            : null
        }),
      confirmedRunOptions: (id) =>
        Effect.sync(() => {
          const row = db
            .prepare("SELECT confirmed_run_options FROM sessions WHERE id = ?")
            .get(id) as { confirmed_run_options: string | null } | undefined
          const stored = row?.confirmed_run_options ?? null
          return stored === null ? null : (JSON.parse(stored) as RunOptions)
        }),
      setConfirmedRunOptions: (id, options) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET confirmed_run_options = ? WHERE id = ?").run(
            JSON.stringify(options),
            id,
          )
        }),
      setRelaunchFailure: (id, failure) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET relaunch_failure = ? WHERE id = ?").run(
            failure === null ? null : JSON.stringify(failure),
            id,
          )
        }),
      setWorkingFolder: (id, workingFolder, branch) =>
        Effect.sync(() => {
          db.prepare(
            `UPDATE sessions SET working_folder = ?, branch = ?, working_folder_deleted = 0
             WHERE id = ?`,
          ).run(workingFolder, branch, id)
        }),
      markWorkingFolderDeleted: (id) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET working_folder_deleted = 1 WHERE id = ?").run(id)
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
      setArchivedAt: (id, at) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET archived_at = ? WHERE id = ?").run(
            at === null ? null : DateTime.toEpochMillis(at),
            id,
          )
        }),
      delete: (id) =>
        Effect.sync(() => {
          db.exec("BEGIN IMMEDIATE")
          try {
            db.prepare("DELETE FROM transcript_events WHERE session_id = ?").run(id)
            db.prepare("DELETE FROM images WHERE session_id = ?").run(id)
            db.prepare("DELETE FROM tabs WHERE session_id = ?").run(id)
            db.prepare(
              "UPDATE open_projects SET selected_session_id = NULL WHERE selected_session_id = ?",
            ).run(id)
            db.prepare("DELETE FROM sessions WHERE id = ?").run(id)
            db.exec("COMMIT")
          } catch (error) {
            db.exec("ROLLBACK")
            throw error
          }
        }),
    }
  }),
)
