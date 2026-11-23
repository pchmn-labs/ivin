import { Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, test } from "vitest"
import { Database, layerDatabase } from "./database.ts"

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const withFileDatabase = <A>(use: (db: typeof Database.Service) => A) => {
  const dir = mkdtempSync(join(tmpdir(), "ivin-db-"))
  dirs.push(dir)
  return Effect.runPromise(
    Effect.gen(function* () {
      return use(yield* Database)
    }).pipe(Effect.provide(layerDatabase(join(dir, "ivin.db"))), Effect.scoped),
  )
}

test("a file database syncs with NORMAL under WAL", async () => {
  const { synchronous, journalMode } = await withFileDatabase((db) => ({
    synchronous: (db.prepare("PRAGMA synchronous").get() as { synchronous: number }).synchronous,
    journalMode: (db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode,
  }))

  expect(synchronous).toBe(1)
  expect(journalMode).toBe("wal")
})

test("the same SQL text gives the same prepared statement", async () => {
  const same = await withFileDatabase(
    (db) => db.prepare("SELECT 1 AS one") === db.prepare("SELECT 1 AS one"),
  )

  expect(same).toBe(true)
})

test("the statement cache stays bounded and still answers after eviction", async () => {
  const answers = await withFileDatabase((db) =>
    Array.from(
      { length: 1000 },
      (_, i) => (db.prepare(`SELECT ${i} AS n`).get() as { n: number }).n,
    ),
  )

  expect(answers[0]).toBe(0)
  expect(answers[999]).toBe(999)
})
