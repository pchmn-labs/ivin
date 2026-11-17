import { Effect, Exit, Layer } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { Database, layerDatabase } from "./database.ts"
import { DatabaseSchemaTooNew, migrations, runMigrations, type Migration } from "./migrations.ts"

const first: Migration = { version: 1, sql: "CREATE TABLE a (id INTEGER)" }
const second: Migration = { version: 2, sql: "CREATE TABLE b (id INTEGER)" }
const tables = (db: DatabaseSync) =>
  (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string
    }[]
  )
    .map((row) => row.name)
    .filter((name) => name !== "migrations")
const versions = (db: DatabaseSync) =>
  (
    db.prepare("SELECT version FROM migrations ORDER BY version").all() as { version: number }[]
  ).map((row) => row.version)

test("an empty database is brought to the latest version", () => {
  const db = new DatabaseSync(":memory:")

  Effect.runSync(runMigrations(db, migrations))

  expect(versions(db)).toEqual(migrations.map((m) => m.version))
  expect(tables(db)).toContain("projects")
})

test("a database at an older version only gets the missing migrations", () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db, [first]))

  Effect.runSync(runMigrations(db, [first, second]))

  expect(versions(db)).toEqual([1, 2])
  expect(tables(db)).toEqual(["a", "b"])
})

test("a failing migration leaves the database untouched", () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db, [first]))

  const exit = Effect.runSyncExit(
    runMigrations(db, [first, second, { version: 3, sql: "NOT SQL" }]),
  )

  expect(Exit.isFailure(exit)).toBe(true)
  expect(versions(db)).toEqual([1])
  expect(tables(db)).toEqual(["a"])
})

test("a newer database makes the server refuse to start and says why", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ivin-db-"))
  try {
    const path = join(dir, "ivin.db")
    await Effect.runPromise(Effect.scoped(Layer.build(layerDatabase(path, [first, second]))))

    const exit = await Effect.runPromiseExit(
      Effect.scoped(Layer.build(layerDatabase(path, [first]))),
    )

    const error = Exit.isFailure(exit)
      ? exit.cause.reasons.map((r) => (r as { error?: unknown }).error)[0]
      : null
    expect(error).toBeInstanceOf(DatabaseSchemaTooNew)
    expect((error as DatabaseSchemaTooNew).message).toContain("version 2")
    expect((error as DatabaseSchemaTooNew).message).toContain("version 1")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the connection is in WAL mode", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ivin-db-"))
  try {
    const mode = await Effect.runPromise(
      Effect.gen(function* () {
        const db = yield* Database
        return db.prepare("PRAGMA journal_mode").get()
      }).pipe(Effect.provide(layerDatabase(join(dir, "ivin.db"))), Effect.scoped),
    )
    expect(mode).toEqual({ journal_mode: "wal" })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
