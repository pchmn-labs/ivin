import { Annotation, type AnnotationTarget } from "@ivin/contracts/annotation"
import { DateTime, Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import {
  makeRowDecoding,
  parseJson,
  rowDecoder,
  type Report,
} from "../../../shared/adapters/row-decoding.ts"
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

const decodeAnnotation = rowDecoder(Annotation, "annotation")

const toAnnotation = (row: AnnotationRow, report: Report) => {
  const data = parseJson(row.data, "annotation", row.id, report)
  if (data === undefined) return undefined
  return decodeAnnotation(
    {
      id: row.id,
      target:
        row.target_type === "session"
          ? { _tag: "session", sessionId: row.target_id }
          : { _tag: "project", projectPath: row.target_id },
      ns: row.ns,
      kind: row.kind,
      data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    row.id,
    report,
  )
}

export const layerSqliteAnnotationStore = Layer.effect(AnnotationStore)(
  Effect.gen(function* () {
    const db = yield* Database
    const decoding = makeRowDecoding()
    return {
      targetExists: (target) =>
        Effect.sync(
          () =>
            (target._tag === "session"
              ? db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(target.sessionId)
              : db.prepare("SELECT 1 FROM projects WHERE path = ?").get(target.projectPath)) !==
            undefined,
        ),
      find: (id) =>
        decoding((report) => {
          const row = db.prepare(`SELECT ${COLUMNS} FROM annotations WHERE id = ?`).get(id) as
            | AnnotationRow
            | undefined
          return (row && toAnnotation(row, report)) ?? null
        }),
      list: (target, kind) =>
        decoding((report) =>
          (
            db
              .prepare(
                `SELECT ${COLUMNS} FROM annotations
                 WHERE target_type = ? AND target_id = ? AND (? IS NULL OR kind = ?)
                 ORDER BY created_at, rowid`,
              )
              .all(...targetColumns(target), kind, kind) as unknown as AnnotationRow[]
          )
            .map((row) => toAnnotation(row, report))
            .filter((annotation) => annotation !== undefined),
        ),
      save: (annotation, key) =>
        decoding((report) => {
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
          return toAnnotation(row, report) ?? annotation
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
