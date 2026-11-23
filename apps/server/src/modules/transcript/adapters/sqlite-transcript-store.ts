import {
  TranscriptEvent,
  TranscriptItem,
  type ImageMediaType,
  type ImageRef,
} from "@ivin/contracts/transcript"
import { DateTime, Effect, Layer } from "effect"
import type { DatabaseSync, SQLInputValue } from "node:sqlite"
import { Database } from "../../../shared/adapters/database.ts"
import {
  makeRowDecoding,
  parseJson,
  rowDecoder,
  type Report,
} from "../../../shared/adapters/row-decoding.ts"
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

const decodeEvent = rowDecoder(TranscriptEvent, "transcript event")
const decodeItem = rowDecoder(TranscriptItem, "transcript item")

const toEvent = (row: EventRow, report: Report) => {
  const payload = parseJson(row.payload, "transcript event", row.id, report)
  if (payload === undefined) return undefined
  return decodeEvent(
    {
      ...(payload as object),
      id: row.id,
      sessionId: row.session_id,
      sequence: row.sequence,
      type: row.type,
      at: row.at,
    },
    row.id,
    report,
  )
}

const toItem = (row: { id: string; payload: string }, report: Report) => {
  const payload = parseJson(row.payload, "transcript item", row.id, report)
  return payload === undefined ? undefined : decodeItem(payload, row.id, report)
}

type UserMessageEvent = Extract<TranscriptEvent, { type: "user_message" }>
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
    const decoding = makeRowDecoding()
    const upsertItem = db.prepare(
      `INSERT INTO transcript_items (id, session_id, position, type, payload) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET payload = excluded.payload`,
    )
    const writeItem = (item: TranscriptItem) =>
      upsertItem.run(item.id, item.sessionId, item.position, item.type, JSON.stringify(item))

    const readEvents = (
      report: Report,
      sessionId: string,
      type: TranscriptEvent["type"] | null = null,
    ) => {
      const rows = db
        .prepare(
          `SELECT ${EVENT_COLUMNS} FROM transcript_events
           WHERE session_id = ? AND (? IS NULL OR type = ?) ORDER BY sequence`,
        )
        .all(sessionId, type, type) as unknown as EventRow[]
      const images = compressedImages(db, sessionId)
      return rows
        .map((row) => toEvent(row, report))
        .filter((event) => event !== undefined)
        .map((event) =>
          event.type === "user_message" && event.images
            ? { ...event, images: images(event.images) }
            : event,
        )
    }

    const readItems = (report: Report, sql: string, ...params: SQLInputValue[]) =>
      (db.prepare(sql).all(...params) as { id: string; payload: string }[])
        .map((row) => toItem(row, report))
        .filter((item) => item !== undefined)

    return {
      append: ({ id, sessionId, sequence, at, ...body }, { item, openMessageId }, touchedAt) =>
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
            if (touchedAt)
              db.prepare("UPDATE sessions SET last_activity_at = ? WHERE id = ?").run(
                DateTime.toEpochMillis(touchedAt),
                sessionId,
              )
          }),
        ),
      lastSequence: (sessionId) =>
        Effect.sync(() => {
          const row = db
            .prepare("SELECT MAX(sequence) AS sequence FROM transcript_events WHERE session_id = ?")
            .get(sessionId) as { sequence: number | null }
          return row.sequence ?? 0
        }),
      userMessages: (sessionId) =>
        decoding((report) =>
          readEvents(report, sessionId, "user_message").filter(
            (event): event is UserMessageEvent => event.type === "user_message",
          ),
        ),
      ensureItems: (sessionId, version, derive) =>
        decoding((report) => {
          const stored = db
            .prepare("SELECT version FROM transcript_item_states WHERE session_id = ?")
            .get(sessionId) as { version: number } | undefined
          if (stored?.version === version) return
          const { items, openMessageId } = derive(readEvents(report, sessionId))
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
        decoding((report) => {
          const earlier = readItems(
            report,
            `SELECT id, payload FROM transcript_items
             WHERE session_id = ? AND position < ? ORDER BY position DESC LIMIT ?`,
            sessionId,
            position ?? Number.MAX_SAFE_INTEGER,
            before + 1,
          )
          const later =
            position === null
              ? []
              : readItems(
                  report,
                  `SELECT id, payload FROM transcript_items
                   WHERE session_id = ? AND position >= ? ORDER BY position LIMIT ?`,
                  sessionId,
                  position,
                  after + 1,
                )
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
      usageTotal: (sessionId) =>
        Effect.sync(() => {
          const row = db
            .prepare(
              `SELECT COUNT(*) AS count,
                      COALESCE(SUM((payload ->> '$.inputTokens') + (payload ->> '$.outputTokens')), 0) AS tokens,
                      COALESCE(SUM(payload ->> '$.costUsd'), 0) AS costUsd
               FROM transcript_items WHERE session_id = ? AND type = 'usage'`,
            )
            .get(sessionId) as { count: number; tokens: number; costUsd: number }
          return row.count === 0 ? null : { tokens: row.tokens, costUsd: row.costUsd }
        }),
      itemState: (sessionId) =>
        decoding((report): ItemState => {
          const open = readItems(
            report,
            `SELECT id, payload FROM transcript_items WHERE session_id = ? AND (
               (type = 'tool_call' AND payload ->> '$.status' = 'running')
               OR (type = 'approval' AND payload ->> '$.decision' IS NULL)
               OR (type = 'question' AND payload ->> '$.status' = 'open')
             ) ORDER BY position`,
            sessionId,
          )
          const [openMessage] = readItems(
            report,
            `SELECT i.id, i.payload FROM transcript_item_states s
             JOIN transcript_items i ON i.id = s.open_message_id WHERE s.session_id = ?`,
            sessionId,
          )
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
