import type { TranscriptEvent } from "@ivin/contracts/transcript"
import { DateTime, Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { TranscriptStore } from "../usecases/transcript-store.ts"

interface EventRow {
  id: string
  session_id: string
  sequence: number
  type: string
  at: number
  payload: string
}

// The payload holds the event body, `raw` included; the other fields have their own columns.
const toEvent = (row: EventRow): TranscriptEvent =>
  ({
    ...JSON.parse(row.payload),
    id: row.id,
    sessionId: row.session_id,
    sequence: row.sequence,
    type: row.type,
    at: DateTime.makeUnsafe(row.at),
  }) as TranscriptEvent

export const layerSqliteTranscriptStore = Layer.effect(TranscriptStore)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      append: ({ id, sessionId, sequence, at, ...body }) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO transcript_events (id, session_id, sequence, type, at, payload)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(
            id,
            sessionId,
            sequence,
            body.type,
            DateTime.toEpochMillis(at),
            JSON.stringify({ ...body, raw: body.raw ?? null }),
          )
        }),
      lastSequence: (sessionId) =>
        Effect.sync(() => {
          const row = db
            .prepare("SELECT MAX(sequence) AS sequence FROM transcript_events WHERE session_id = ?")
            .get(sessionId) as { sequence: number | null }
          return row.sequence ?? 0
        }),
      events: (sessionId) =>
        Effect.sync(() =>
          (
            db
              .prepare(
                `SELECT id, session_id, sequence, type, at, payload FROM transcript_events
                 WHERE session_id = ? ORDER BY sequence`,
              )
              .all(sessionId) as unknown as EventRow[]
          ).map(toEvent),
        ),
    }
  }),
)
