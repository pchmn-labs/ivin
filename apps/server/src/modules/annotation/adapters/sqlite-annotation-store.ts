import type { Annotation, AnnotationTarget } from "@ivin/contracts/annotation"
import { DateTime, Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { AnnotationStore } from "../usecases/annotation-store.ts"

interface AnnotationRow {
  id: string
  target_type: string
  target_id: string
  ns: string
  kind: string
  data: string
  created_at: number
  updated_at: number
}

const COLUMNS = "id, target_type, target_id, ns, kind, data, created_at, updated_at"

const targetColumns = (target: AnnotationTarget) =>
  target._tag === "session"
    ? (["session", target.sessionId] as const)
    : (["project", target.projectPath] as const)

const toAnnotation = (row: AnnotationRow): Annotation => ({
  id: row.id,
  target:
    row.target_type === "session"
      ? { _tag: "session", sessionId: row.target_id }
      : { _tag: "project", projectPath: row.target_id },
  ns: row.ns,
  kind: row.kind,
  data: JSON.parse(row.data),
  createdAt: DateTime.makeUnsafe(row.created_at),
  updatedAt: DateTime.makeUnsafe(row.updated_at),
})

export const layerSqliteAnnotationStore = Layer.effect(AnnotationStore)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      find: (id) =>
        Effect.sync(() => {
          const row = db.prepare(`SELECT ${COLUMNS} FROM annotations WHERE id = ?`).get(id) as
            | AnnotationRow
            | undefined
          return row ? toAnnotation(row) : null
        }),
      list: (target, kind) =>
        Effect.sync(() =>
          (
            db
              .prepare(
                `SELECT ${COLUMNS} FROM annotations
                 WHERE target_type = ? AND target_id = ? AND (? IS NULL OR kind = ?)
                 ORDER BY created_at, rowid`,
              )
              .all(...targetColumns(target), kind, kind) as unknown as AnnotationRow[]
          ).map(toAnnotation),
        ),
      save: (annotation, key) =>
        Effect.sync(() => {
          const row = db
            .prepare(
              `INSERT INTO annotations (${COLUMNS}, key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (target_type, target_id, ns, kind, key) WHERE key IS NOT NULL
               DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
               RETURNING ${COLUMNS}`,
            )
            .get(
              annotation.id,
              ...targetColumns(annotation.target),
              annotation.ns,
              annotation.kind,
              JSON.stringify(annotation.data),
              DateTime.toEpochMillis(annotation.createdAt),
              DateTime.toEpochMillis(annotation.updatedAt),
              key,
            ) as unknown as AnnotationRow
          return toAnnotation(row)
        }),
      remove: (id) =>
        Effect.sync(() => {
          db.prepare("DELETE FROM annotations WHERE id = ?").run(id)
        }),
      removeByTarget: (target) =>
        Effect.sync(() => {
          db.prepare("DELETE FROM annotations WHERE target_type = ? AND target_id = ?").run(
            ...targetColumns(target),
          )
        }),
    }
  }),
)
