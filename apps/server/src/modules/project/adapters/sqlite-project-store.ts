import type { Project } from "@ivin/contracts/project"
import { DateTime, Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { ProjectStore } from "../usecases/project-store.ts"

interface ProjectRow {
  path: string
  name: string
  last_opened_at: number
}

export const layerSqliteProjectStore = Layer.effect(ProjectStore)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      save: (project: Project) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO projects (path, name, last_opened_at) VALUES (?, ?, ?)
             ON CONFLICT (path) DO UPDATE SET name = excluded.name, last_opened_at = excluded.last_opened_at`,
          ).run(project.path, project.name, DateTime.toEpochMillis(project.lastOpenedAt))
        }),
      findLastOpened: Effect.sync(() => {
        const row = db
          .prepare(
            "SELECT path, name, last_opened_at FROM projects ORDER BY last_opened_at DESC LIMIT 1",
          )
          .get() as ProjectRow | undefined
        return row
          ? {
              path: row.path,
              name: row.name,
              lastOpenedAt: DateTime.makeUnsafe(row.last_opened_at),
            }
          : null
      }),
    }
  }),
)
