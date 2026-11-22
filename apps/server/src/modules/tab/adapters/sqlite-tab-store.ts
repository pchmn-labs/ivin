import type { SubView, Tab } from "@ivin/contracts/tab"
import { Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { type StoredSubView, TabStore } from "../usecases/tab-store.ts"

interface TabRow {
  session_id: string
  project_path: string
}

const toTab = (row: TabRow): Tab => ({ sessionId: row.session_id, projectPath: row.project_path })

interface SubViewRow {
  kind: SubView["kind"]
  path: string
  working_folder: string
  selected: number
}

const toStoredSubView = (row: SubViewRow): StoredSubView => ({
  subView: { kind: row.kind, path: row.path },
  workingFolder: row.working_folder,
  selected: row.selected === 1,
})

export const layerSqliteTabStore = Layer.effect(TabStore)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      find: (sessionId) =>
        Effect.sync(() => {
          const row = db
            .prepare("SELECT session_id, project_path FROM tabs WHERE session_id = ?")
            .get(sessionId) as TabRow | undefined
          return row ? toTab(row) : null
        }),
      listByProject: (projectPath) =>
        Effect.sync(() =>
          (
            db
              .prepare(
                "SELECT session_id, project_path FROM tabs WHERE project_path = ? ORDER BY position",
              )
              .all(projectPath) as unknown as TabRow[]
          ).map(toTab),
        ),
      selectedOf: (projectPath) =>
        Effect.sync(() => {
          const row = db
            .prepare("SELECT selected_session_id FROM open_projects WHERE path = ?")
            .get(projectPath) as { selected_session_id: string | null } | undefined
          return row?.selected_session_id ?? null
        }),
      append: (tab) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO tabs (session_id, project_path, position)
             VALUES (?, ?, (SELECT COALESCE(MAX(position) + 1, 0) FROM tabs WHERE project_path = ?))`,
          ).run(tab.sessionId, tab.projectPath, tab.projectPath)
        }),
      remove: (sessionId) =>
        Effect.sync(() => {
          db.prepare("DELETE FROM sub_views WHERE session_id = ?").run(sessionId)
          db.prepare("DELETE FROM tabs WHERE session_id = ?").run(sessionId)
        }),
      removeByProject: (projectPath) =>
        Effect.sync(() => {
          db.prepare(
            "DELETE FROM sub_views WHERE session_id IN (SELECT session_id FROM tabs WHERE project_path = ?)",
          ).run(projectPath)
          db.prepare("DELETE FROM tabs WHERE project_path = ?").run(projectPath)
        }),
      setOrder: (projectPath, sessionIds) =>
        Effect.sync(() => {
          const update = db.prepare(
            "UPDATE tabs SET position = ? WHERE session_id = ? AND project_path = ?",
          )
          sessionIds.forEach((id, position) => update.run(position, id, projectPath))
        }),
      select: (projectPath, sessionId) =>
        Effect.sync(() => {
          db.prepare("UPDATE open_projects SET selected_session_id = ? WHERE path = ?").run(
            sessionId,
            projectPath,
          )
        }),
      subViewsOf: (sessionId) =>
        Effect.sync(() =>
          (
            db
              .prepare(
                "SELECT kind, path, working_folder, selected FROM sub_views WHERE session_id = ? ORDER BY position",
              )
              .all(sessionId) as unknown as SubViewRow[]
          ).map(toStoredSubView),
        ),
      appendSubView: (sessionId, subView, workingFolder) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO sub_views (session_id, position, kind, path, working_folder)
             VALUES (?, (SELECT COALESCE(MAX(position) + 1, 0) FROM sub_views WHERE session_id = ?), ?, ?, ?)`,
          ).run(sessionId, sessionId, subView.kind, subView.path, workingFolder)
        }),
      removeSubView: (sessionId, subView) =>
        Effect.sync(() => {
          db.prepare("DELETE FROM sub_views WHERE session_id = ? AND kind = ? AND path = ?").run(
            sessionId,
            subView.kind,
            subView.path,
          )
        }),
      selectSubView: (sessionId, subView) =>
        Effect.sync(() => {
          db.prepare(
            "UPDATE sub_views SET selected = (kind = ? AND path = ?) WHERE session_id = ?",
          ).run(subView?.kind ?? "", subView?.path ?? "", sessionId)
        }),
      layoutOf: (sessionId) =>
        Effect.sync(() => {
          const row = db
            .prepare("SELECT full_width, session_tab_selected FROM tabs WHERE session_id = ?")
            .get(sessionId) as { full_width: number; session_tab_selected: number } | undefined
          return {
            fullWidth: row?.full_width === 1,
            sessionTabSelected: row?.session_tab_selected === 1,
          }
        }),
      setLayout: (sessionId, layout) =>
        Effect.sync(() => {
          db.prepare(
            "UPDATE tabs SET full_width = ?, session_tab_selected = ? WHERE session_id = ?",
          ).run(Number(layout.fullWidth), Number(layout.sessionTabSelected), sessionId)
        }),
      removeSubViewsOutside: (sessionId, workingFolder) =>
        Effect.sync(() => {
          db.prepare("DELETE FROM sub_views WHERE session_id = ? AND working_folder <> ?").run(
            sessionId,
            workingFolder,
          )
        }),
    }
  }),
)
