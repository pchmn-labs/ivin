import type { TranscriptItem } from "@ivin/contracts/transcript"
import { DateTime, Effect, Layer } from "effect"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { Database } from "../../../shared/adapters/database.ts"
import { runMigrations } from "../../../shared/adapters/migrations.ts"
import { TranscriptStore } from "../usecases/transcript-store.ts"
import { layerSqliteTranscriptStore } from "./sqlite-transcript-store.ts"

const itemsAt = (positions: readonly number[]): TranscriptItem[] =>
  positions.map((position, i) => ({
    id: `i${i}`,
    sessionId: "s1",
    position,
    at: 0,
    type: "thinking",
    text: "",
  }))

const pageOf = (
  items: readonly TranscriptItem[],
  position: number | null,
  before: number,
  after: number,
) => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  return Effect.runSync(
    Effect.gen(function* () {
      const store = yield* TranscriptStore
      yield* store.ensureItems("s1", 1, () => ({ items, openMessageId: null }))
      return yield* store.itemsPage("s1", position, before, after)
    }).pipe(
      Effect.provide(layerSqliteTranscriptStore.pipe(Layer.provide(Layer.succeed(Database)(db)))),
    ),
  )
}

const ten = itemsAt(Array.from({ length: 10 }, (_, i) => (i + 1) * 2))
const ids = (page: { items: readonly TranscriptItem[] }) => page.items.map((item) => item.id)

test("a null position pages the end of the transcript", () => {
  const page = pageOf(ten, null, 3, 5)

  expect(ids(page)).toEqual(["i7", "i8", "i9"])
  expect(page).toMatchObject({ hasBefore: true, hasAfter: false })
})

test("a position pages around the first item at or after it", () => {
  const page = pageOf(ten, 9, 2, 2)

  expect(ids(page)).toEqual(["i2", "i3", "i4", "i5"])
  expect(page).toMatchObject({ hasBefore: true, hasAfter: true })
})

test("a small transcript comes back whole with nothing before or after", () => {
  const page = pageOf(ten.slice(0, 2), null, 50, 50)

  expect(ids(page)).toEqual(["i0", "i1"])
  expect(page).toMatchObject({ hasBefore: false, hasAfter: false })
})

test("a page leaves out a subagent's steps, which load with its task", () => {
  const steps = itemsAt([1, 3, 5, 7]).map((item, i) =>
    i % 2 === 0 ? item : { ...item, id: `step${i}`, parentToolCallId: "agent" },
  )
  const page = pageOf(steps, null, 1, 0)

  expect(ids(page)).toEqual(["i2"])
  expect(page).toMatchObject({ hasBefore: true, hasAfter: false })
})

test("an empty transcript gives an empty page", () => {
  expect(pageOf([], null, 5, 5)).toEqual({ items: [], hasBefore: false, hasAfter: false })
})

const eventAt = (id: string, sequence: number) => ({
  id,
  sessionId: "s1",
  sequence,
  at: DateTime.makeUnsafe(5_000),
  type: "interruption" as const,
})

const lastActivity = (db: DatabaseSync) =>
  (
    db.prepare("SELECT last_activity_at AS at FROM sessions WHERE id = 's1'").get() as {
      at: number
    }
  ).at

test("an event and the session's activity time are written in one transaction", () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  db.prepare(
    `INSERT INTO sessions (id, project_path, working_folder, title, harness, model, effort,
       permission_mode, run_options_at, status, status_changed_at, created_at, last_activity_at)
     VALUES ('s1', '/p', '/p', 't', 'scripted', 'm', 'e', 'p', 1, 'idle', 1, 1, 1)`,
  ).run()
  const change = { item: null, openMessageId: null }
  const run = (id: string, sequence: number, touchedAt: DateTime.Utc | null) =>
    Effect.runSync(
      Effect.gen(function* () {
        yield* (yield* TranscriptStore).append(eventAt(id, sequence), change, touchedAt)
      }).pipe(
        Effect.provide(layerSqliteTranscriptStore.pipe(Layer.provide(Layer.succeed(Database)(db)))),
      ),
    )

  run("e1", 1, DateTime.makeUnsafe(9_000))
  expect(lastActivity(db)).toBe(9_000)

  expect(() => run("e1", 2, DateTime.makeUnsafe(12_000))).toThrow()
  expect(lastActivity(db)).toBe(9_000)
})
