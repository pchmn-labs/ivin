import type {
  ImageMediaType,
  ImageRef,
  TranscriptEvent,
  TranscriptItem,
} from "@ivin/contracts/transcript"
import { DateTime, Effect, Layer } from "effect"
import type { DatabaseSync } from "node:sqlite"
import { Database } from "../../../shared/adapters/database.ts"
import type { ItemState } from "../rules/derive-items.ts"
import { TranscriptStore } from "../usecases/transcript-store.ts"

interface EventRow {
  id: string
  session_id: string
  sequence: number
  type: string
  at: number
  payload: string
}

const EVENT_COLUMNS = "id, session_id, sequence, type, at, payload"

const toEvent = (row: EventRow): TranscriptEvent =>
  ({
    ...JSON.parse(row.payload),
    id: row.id,
    sessionId: row.session_id,
    sequence: row.sequence,
    type: row.type,
    at: DateTime.makeUnsafe(row.at),
  }) as TranscriptEvent

const toItem = (row: { payload: string }) => JSON.parse(row.payload) as TranscriptItem

type OpenToolCall = Extract<TranscriptItem, { type: "tool_call" }>
type OpenRequest = Extract<TranscriptItem, { type: "approval" | "question" }>

// Images are stored with the type they were sent in; compression changes it afterwards.
const compressedImages = (db: DatabaseSync, sessionId: string) => {
  const compressed = new Map(
    (
      db
        .prepare(
          `SELECT id, compressed_media_type FROM images
           WHERE session_id = ? AND compressed_media_type IS NOT NULL`,
        )
        .all(sessionId) as { id: string; compressed_media_type: ImageMediaType }[]
    ).map((row) => [row.id, row.compressed_media_type]),
  )
  return (images: readonly ImageRef[]) =>
    compressed.size === 0
      ? images
      : images.map((image) => ({
          ...image,
          mediaType: compressed.get(image.id) ?? image.mediaType,
        }))
}

const inTransaction = (db: DatabaseSync, body: () => void) => {
  db.exec("BEGIN IMMEDIATE")
  try {
    body()
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

export const layerSqliteTranscriptStore = Layer.effect(TranscriptStore)(
  Effect.gen(function* () {
    const db = yield* Database
    const upsertItem = db.prepare(
      `INSERT INTO transcript_items (id, session_id, position, type, payload) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET payload = excluded.payload`,
    )
    const writeItem = (item: TranscriptItem) =>
      upsertItem.run(item.id, item.sessionId, item.position, item.type, JSON.stringify(item))

    const readEvents = (sessionId: string) => {
      const rows = db
        .prepare(
          `SELECT ${EVENT_COLUMNS} FROM transcript_events WHERE session_id = ? ORDER BY sequence`,
        )
        .all(sessionId) as unknown as EventRow[]
      const images = compressedImages(db, sessionId)
      return rows
        .map(toEvent)
        .map((event) =>
          event.type === "user_message" && event.images
            ? { ...event, images: images(event.images) }
            : event,
        )
    }

    return {
      append: ({ id, sessionId, sequence, at, ...body }, { item, openMessageId }) =>
        Effect.sync(() =>
          inTransaction(db, () => {
            db.prepare(
              `INSERT INTO transcript_events (${EVENT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`,
            ).run(
              id,
              sessionId,
              sequence,
              body.type,
              DateTime.toEpochMillis(at),
              JSON.stringify(body),
            )
            if (item) writeItem(item)
            db.prepare(
              "UPDATE transcript_item_states SET open_message_id = ? WHERE session_id = ?",
            ).run(openMessageId, sessionId)
          }),
        ),
      lastSequence: (sessionId) =>
        Effect.sync(() => {
          const row = db
            .prepare("SELECT MAX(sequence) AS sequence FROM transcript_events WHERE session_id = ?")
            .get(sessionId) as { sequence: number | null }
          return row.sequence ?? 0
        }),
      events: (sessionId) => Effect.sync(() => readEvents(sessionId)),
      userMessages: (sessionId) =>
        Effect.sync(() => {
          const rows = db
            .prepare(
              `SELECT ${EVENT_COLUMNS} FROM transcript_events
               WHERE session_id = ? AND type = 'user_message' ORDER BY sequence`,
            )
            .all(sessionId) as unknown as EventRow[]
          const images = compressedImages(db, sessionId)
          return rows
            .map(toEvent)
            .flatMap((event) =>
              event.type === "user_message"
                ? [{ ...event, ...(event.images && { images: images(event.images) }) }]
                : [],
            )
        }),
      ensureItems: (sessionId, version, derive) =>
        Effect.sync(() => {
          const stored = db
            .prepare("SELECT version FROM transcript_item_states WHERE session_id = ?")
            .get(sessionId) as { version: number } | undefined
          if (stored?.version === version) return
          const { items, openMessageId } = derive(readEvents(sessionId))
          inTransaction(db, () => {
            db.prepare("DELETE FROM transcript_items WHERE session_id = ?").run(sessionId)
            for (const item of items) writeItem(item)
            db.prepare(
              `INSERT INTO transcript_item_states (session_id, version, open_message_id)
               VALUES (?, ?, ?)
               ON CONFLICT (session_id) DO UPDATE SET
                 version = excluded.version, open_message_id = excluded.open_message_id`,
            ).run(sessionId, version, openMessageId)
          })
        }),
      itemsPage: (sessionId, position, before, after) =>
        Effect.sync(() => {
          const earlier = (
            db
              .prepare(
                `SELECT payload FROM transcript_items
                 WHERE session_id = ? AND position < ? ORDER BY position DESC LIMIT ?`,
              )
              .all(sessionId, position ?? Number.MAX_SAFE_INTEGER, before + 1) as {
              payload: string
            }[]
          ).map(toItem)
          const later =
            position === null
              ? []
              : (
                  db
                    .prepare(
                      `SELECT payload FROM transcript_items
                       WHERE session_id = ? AND position >= ? ORDER BY position LIMIT ?`,
                    )
                    .all(sessionId, position, after + 1) as { payload: string }[]
                ).map(toItem)
          const items = [...earlier.slice(0, before).toReversed(), ...later.slice(0, after)]
          const images = compressedImages(db, sessionId)
          return {
            items: items.map((item) =>
              item.type === "message" && item.images.length > 0
                ? { ...item, images: images(item.images) }
                : item,
            ),
            hasBefore: earlier.length > before,
            hasAfter: later.length > after,
          }
        }),
      itemState: (sessionId) =>
        Effect.sync((): ItemState => {
          const open = (
            db
              .prepare(
                `SELECT payload FROM transcript_items WHERE session_id = ? AND (
                   (type = 'tool_call' AND payload ->> '$.status' = 'running')
                   OR (type = 'approval' AND payload ->> '$.decision' IS NULL)
                   OR (type = 'question' AND payload ->> '$.status' = 'open')
                 ) ORDER BY position`,
              )
              .all(sessionId) as { payload: string }[]
          ).map(toItem)
          const message = db
            .prepare(
              `SELECT i.payload FROM transcript_item_states s
               JOIN transcript_items i ON i.id = s.open_message_id WHERE s.session_id = ?`,
            )
            .get(sessionId) as { payload: string } | undefined
          const openMessage = message ? toItem(message) : null
          return {
            openMessage: openMessage?.type === "message" ? openMessage : null,
            openToolCalls: new Map(
              open
                .filter((item): item is OpenToolCall => item.type === "tool_call")
                .map((item) => [item.toolCallId, item]),
            ),
            openRequests: new Map(
              open
                .filter((item): item is OpenRequest => item.type !== "tool_call")
                .map((item) => [item.requestId, item]),
            ),
          }
        }),
    }
  }),
)
