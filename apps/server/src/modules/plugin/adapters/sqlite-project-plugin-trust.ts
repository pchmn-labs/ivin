import { Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { ProjectPluginTrustStore } from "../usecases/project-plugin-trust-store.ts"

interface ChangeRow {
  plugin: string
  name: string
  hash: string
  at: number
  is_new: number
  files: string
  diff: string
  seen: number
}

export const layerSqliteProjectPluginTrust = Layer.effect(ProjectPluginTrustStore)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      trusted: (project, id) =>
        Effect.sync(() => {
          const row = db
            .prepare(
              "SELECT hash, permissions FROM project_plugin_trust WHERE project = ? AND plugin = ?",
            )
            .get(project, id) as { hash: string; permissions: string } | undefined
          return row === undefined
            ? null
            : { hash: row.hash, permissions: JSON.parse(row.permissions) as string[] }
        }),
      trust: (project, id, { hash, permissions }) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO project_plugin_trust (project, plugin, hash, permissions) VALUES (?, ?, ?, ?)
             ON CONFLICT (project, plugin) DO UPDATE SET hash = excluded.hash, permissions = excluded.permissions`,
          ).run(project, id, hash, JSON.stringify(permissions))
        }),
      fullTrust: (project) =>
        Effect.sync(
          () =>
            db.prepare("SELECT 1 FROM project_plugin_full_trust WHERE project = ?").get(project) !==
            undefined,
        ),
      setFullTrust: (project, enabled) =>
        Effect.sync(() => {
          if (enabled) {
            db.prepare("INSERT OR IGNORE INTO project_plugin_full_trust (project) VALUES (?)").run(
              project,
            )
          } else {
            db.prepare("DELETE FROM project_plugin_full_trust WHERE project = ?").run(project)
          }
        }),
      changes: (project) =>
        Effect.sync(() =>
          (
            db
              .prepare(
                `SELECT plugin, name, hash, at, is_new, files, diff, seen
                 FROM project_plugin_changes WHERE project = ? ORDER BY id`,
              )
              .all(project) as unknown as ChangeRow[]
          ).map((row) => ({
            id: row.plugin,
            name: row.name,
            hash: row.hash,
            at: row.at,
            isNew: row.is_new === 1,
            files: JSON.parse(row.files),
            diff: row.diff,
            seen: row.seen === 1,
          })),
        ),
      addChange: (project, change) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO project_plugin_changes (project, plugin, name, hash, at, is_new, files, diff, seen)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            project,
            change.id,
            change.name,
            change.hash,
            change.at,
            change.isNew ? 1 : 0,
            JSON.stringify(change.files),
            change.diff,
            change.seen ? 1 : 0,
          )
        }),
      markChangesSeen: (project) =>
        Effect.sync(() => {
          db.prepare("UPDATE project_plugin_changes SET seen = 1 WHERE project = ?").run(project)
        }),
    }
  }),
)
