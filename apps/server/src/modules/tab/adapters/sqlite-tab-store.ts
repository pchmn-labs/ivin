import type { Tab } from "@ivin/contracts/tab"
import { Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { TabStore } from "../usecases/tab-store.ts"

interface TabRow {
  session_id: string
  project_path: string
}

const toTab = (row: TabRow): Tab => ({ sessionId: row.session_id, projectPath: row.project_path })

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
          db.prepare("DELETE FROM tabs WHERE session_id = ?").run(sessionId)
        }),
      removeByProject: (projectPath) =>
        Effect.sync(() => {
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
    }
  }),
)
