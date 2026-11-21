import { DateTime, Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { ProjectStore } from "../usecases/project-store.ts"

interface OpenProjectRow {
  path: string
  name: string
  last_opened_at: number
}

export const layerSqliteProjectStore = Layer.effect(ProjectStore)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      save: (project) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO projects (path, name, last_opened_at) VALUES (?, ?, ?)
             ON CONFLICT (path) DO UPDATE SET name = excluded.name, last_opened_at = excluded.last_opened_at`,
          ).run(project.path, project.name, DateTime.toEpochMillis(project.lastOpenedAt))
        }),
      isKnown: (path) =>
        Effect.sync(
          () => db.prepare("SELECT 1 FROM projects WHERE path = ?").get(path) !== undefined,
        ),
      listOpen: Effect.sync(() => {
        const rows = db
          .prepare(
            `SELECT p.path, p.name, p.last_opened_at FROM open_projects o
             JOIN projects p ON p.path = o.path ORDER BY o.position`,
          )
          .all() as unknown as OpenProjectRow[]
        const selected = db.prepare("SELECT selected_project_path FROM workspace").get() as
          | { selected_project_path: string | null }
          | undefined
        return {
          projects: rows.map((row) => ({
            path: row.path,
            name: row.name,
            lastOpenedAt: DateTime.makeUnsafe(row.last_opened_at),
          })),
          selectedPath: selected?.selected_project_path ?? null,
        }
      }),
      addOpen: (path) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT OR IGNORE INTO open_projects (path, position)
             VALUES (?, (SELECT COALESCE(MAX(position) + 1, 0) FROM open_projects))`,
          ).run(path)
        }),
      removeOpen: (path) =>
        Effect.sync(() => {
          db.prepare("DELETE FROM open_projects WHERE path = ?").run(path)
        }),
      select: (path) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO workspace (id, selected_project_path) VALUES (1, ?)
             ON CONFLICT (id) DO UPDATE SET selected_project_path = excluded.selected_project_path`,
          ).run(path)
        }),
    }
  }),
)
