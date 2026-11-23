import type { TranscriptItem } from "@ivin/contracts/transcript"
import { Effect, Layer } from "effect"
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

test("an empty transcript gives an empty page", () => {
  expect(pageOf([], null, 5, 5)).toEqual({ items: [], hasBefore: false, hasAfter: false })
})
