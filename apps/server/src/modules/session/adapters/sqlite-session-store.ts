import {
  BackgroundTask,
  PendingMessage,
  RelaunchFailure,
  RunOptions,
  type Harness,
  type Session,
  type SessionStatus,
  type WaitingFor,
} from "@ivin/contracts/session"
import { Schema } from "effect"
import { DateTime, Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import {
  makeRowDecoding,
  parseJson,
  rowDecoder,
  type Report,
} from "../../../shared/adapters/row-decoding.ts"
import { SessionStore } from "../usecases/session-store.ts"

interface SessionRow {
  id: string
  project_path: string
  working_folder: string
  in_worktree: number | null
  branch: string | null
  started: number
  working_folder_deleted: number
  title: string
  harness: Harness
  model: string
  effort: string
  permission_mode: string
  relaunch_failure: string | null
  pending_messages: string
  unread_messages: string
  status: SessionStatus
  waiting_for: WaitingFor
  background_tasks: string
  status_changed_at: number
  created_at: number
  last_activity_at: number
  archived_at: number | null
  last_image_number: number
}

const decodeMessages = rowDecoder(Schema.Array(PendingMessage), "session messages")
const decodeBackgroundTasks = rowDecoder(Schema.Array(BackgroundTask), "session background tasks")
const decodeRelaunchFailure = rowDecoder(RelaunchFailure, "session relaunch failure")
const decodeRunOptions = rowDecoder(RunOptions, "session run options")

const messagesOf = (id: string, column: string, stored: string, report: Report) => {
  const key = `${id}.${column}`
  const parsed = parseJson(stored, "session messages", key, report)
  return parsed === undefined ? [] : (decodeMessages(parsed, key, report) ?? [])
}

const backgroundTasksOf = (row: SessionRow, report: Report) => {
  const parsed = parseJson(row.background_tasks, "session background tasks", row.id, report)
  return parsed === undefined ? [] : (decodeBackgroundTasks(parsed, row.id, report) ?? [])
}

const relaunchFailureOf = (row: SessionRow, report: Report) => {
  if (row.relaunch_failure === null) return null
  const parsed = parseJson(row.relaunch_failure, "session relaunch failure", row.id, report)
  return parsed === undefined ? null : (decodeRelaunchFailure(parsed, row.id, report) ?? null)
}

const toSession = (row: SessionRow, report: Report): Session => ({
  id: row.id,
  projectPath: row.project_path,
  workingFolder: row.working_folder,
  inWorktree:
    row.in_worktree === null ? row.working_folder !== row.project_path : row.in_worktree === 1,
  branch: row.branch,
  started: row.started === 1,
  workingFolderDeleted: row.working_folder_deleted === 1,
  title: row.title,
  harness: row.harness,
  model: row.model,
  effort: row.effort,
  permissionMode: row.permission_mode,
  relaunchFailure: relaunchFailureOf(row, report),
  pendingMessages: messagesOf(row.id, "pending_messages", row.pending_messages, report),
  unreadMessages: messagesOf(row.id, "unread_messages", row.unread_messages, report),
  status: row.status,
  waitingFor: row.waiting_for,
  backgroundTasks: backgroundTasksOf(row, report),
  statusChangedAt: DateTime.makeUnsafe(row.status_changed_at),
  createdAt: DateTime.makeUnsafe(row.created_at),
  lastActivityAt: DateTime.makeUnsafe(row.last_activity_at),
  archivedAt: row.archived_at === null ? null : DateTime.makeUnsafe(row.archived_at),
  lastImageNumber: row.last_image_number,
})

const columns = `id, project_path, working_folder, in_worktree, working_folder_deleted, branch, title, harness, model,
  effort, permission_mode, relaunch_failure, pending_messages, unread_messages, status,
  waiting_for, background_tasks, status_changed_at, created_at, last_activity_at, archived_at, EXISTS (
    SELECT 1 FROM transcript_events e WHERE e.session_id = sessions.id AND e.type = 'user_message'
  ) AS started,
  (SELECT COALESCE(MAX(number), 0) FROM images i WHERE i.session_id = sessions.id) AS last_image_number`

const pendingToUnread = `unread_messages = (
    SELECT json_group_array(json(value)) FROM (
      SELECT 0 AS list, key, value FROM json_each(unread_messages)
      UNION ALL SELECT 1, key, value FROM json_each(pending_messages)
      ORDER BY list, key
    )
  ), pending_messages = '[]'`

export const layerSqliteSessionStore = Layer.effect(SessionStore)(
  Effect.gen(function* () {
    const db = yield* Database
    const decoding = makeRowDecoding()
    const pendingOf = (id: string, report: Report): readonly PendingMessage[] => {
      const row = db.prepare("SELECT pending_messages FROM sessions WHERE id = ?").get(id) as
        | { pending_messages: string }
        | undefined
      return row ? messagesOf(id, "pending_messages", row.pending_messages, report) : []
    }
    return {
      insert: (session) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO sessions (id, project_path, working_folder, in_worktree, branch, title, harness, model,
               effort, permission_mode, run_options_at, status, status_changed_at, created_at,
               last_activity_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            session.id,
            session.projectPath,
            session.workingFolder,
            Number(session.inWorktree),
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
        decoding((report) => {
          const row = db.prepare(`SELECT ${columns} FROM sessions WHERE id = ?`).get(id) as
            | SessionRow
            | undefined
          return row ? toSession(row, report) : null
        }),
      listByProject: (projectPath) =>
        decoding((report) =>
          (
            db
              .prepare(
                `SELECT ${columns} FROM sessions WHERE project_path = ?
                 ORDER BY last_activity_at DESC, created_at DESC`,
              )
              .all(projectPath) as unknown as SessionRow[]
          ).map((row) => toSession(row, report)),
        ),
      rename: (id, title, by) =>
        Effect.sync(
          () =>
            db
              .prepare(
                `UPDATE sessions SET title = ?, title_source = ?
                 WHERE id = ? AND (? = 'user' OR title_source IS NOT 'user')`,
              )
              .run(title, by, id, by).changes > 0,
        ),
      setTitleIfUnset: (id, title) =>
        Effect.sync(() => {
          db.prepare(
            "UPDATE sessions SET title = ?, title_source = 'message' WHERE id = ? AND title_source IS NULL",
          ).run(title, id)
        }),
      replaceMessageTitle: (id, title) =>
        Effect.sync(
          () =>
            db
              .prepare(
                "UPDATE sessions SET title = ?, title_source = 'generated' WHERE id = ? AND title_source = 'message'",
              )
              .run(title, id).changes > 0,
        ),
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
        decoding((report) => {
          const row = db
            .prepare("SELECT confirmed_run_options FROM sessions WHERE id = ?")
            .get(id) as { confirmed_run_options: string | null } | undefined
          const stored = row?.confirmed_run_options ?? null
          if (stored === null) return null
          const parsed = parseJson(stored, "session run options", id, report)
          return parsed === undefined ? null : (decodeRunOptions(parsed, id, report) ?? null)
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
      addPendingMessage: (id, message) =>
        Effect.sync(() => {
          db.prepare(
            "UPDATE sessions SET pending_messages = json_insert(pending_messages, '$[#]', json(?)) WHERE id = ?",
          ).run(JSON.stringify(message), id)
        }),
      takePendingMessage: (id, messageId) =>
        decoding((report) => {
          const pending = pendingOf(id, report)
          const taken = pending.find((message) => message.id === messageId) ?? null
          if (taken === null) return null
          db.prepare("UPDATE sessions SET pending_messages = ? WHERE id = ?").run(
            JSON.stringify(pending.filter((message) => message !== taken)),
            id,
          )
          return taken
        }),
      pendingMessages: (id) => decoding((report) => pendingOf(id, report)),
      markPendingUnread: (id) =>
        Effect.sync(() => {
          db.prepare(`UPDATE sessions SET ${pendingToUnread} WHERE id = ?`).run(id)
        }),
      clearUnreadMessages: (id) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET unread_messages = '[]' WHERE id = ?").run(id)
        }),
      setWorkingFolder: (id, workingFolder, branch, inWorktree) =>
        Effect.sync(() => {
          db.prepare(
            `UPDATE sessions SET working_folder = ?, branch = ?, in_worktree = ?,
             working_folder_deleted = 0 WHERE id = ?`,
          ).run(workingFolder, branch, inWorktree === undefined ? null : Number(inWorktree), id)
        }),
      markWorkingFolderDeleted: (id) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET working_folder_deleted = 1 WHERE id = ?").run(id)
        }),
      setStatus: (id, status, at, waitingFor = null) =>
        Effect.sync(() => {
          const waiting = status === "waiting" ? waitingFor : null
          db.prepare(`UPDATE sessions SET status_changed_at = ? WHERE id = ? AND status <> ?`).run(
            DateTime.toEpochMillis(at),
            id,
            status,
          )
          db.prepare(`UPDATE sessions SET status = ?, waiting_for = ? WHERE id = ?`).run(
            status,
            waiting,
            id,
          )
        }),
      setBackgroundTasks: (id, tasks) =>
        Effect.sync(() => {
          db.prepare("UPDATE sessions SET background_tasks = ? WHERE id = ?").run(
            JSON.stringify(tasks),
            id,
          )
        }),
      resetRunning: Effect.sync(() => {
        const reset = db
          .prepare(
            `UPDATE sessions SET status = 'idle', waiting_for = NULL, background_tasks = '[]',
               status_changed_at = last_activity_at
             WHERE status NOT IN ('idle', 'failed') RETURNING id`,
          )
          .all() as { id: string }[]
        db.prepare(`UPDATE sessions SET ${pendingToUnread} WHERE pending_messages <> '[]'`).run()
        return reset.map((row) => row.id)
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
            db.prepare("DELETE FROM transcript_items WHERE session_id = ?").run(id)
            db.prepare("DELETE FROM transcript_item_states WHERE session_id = ?").run(id)
            db.prepare("DELETE FROM images WHERE session_id = ?").run(id)
            db.prepare("DELETE FROM sub_views WHERE session_id = ?").run(id)
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
