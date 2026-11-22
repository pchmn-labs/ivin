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

test("the milestone 1 project becomes the one open, selected project with a tab per session", () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db, migrations.slice(0, 5)))
  const project = db.prepare("INSERT INTO projects (path, name, last_opened_at) VALUES (?, ?, ?)")
  project.run("/a/old", "old", 1)
  project.run("/a/current", "current", 2)
  const session = db.prepare(
    `INSERT INTO sessions (id, project_path, title, created_at, last_activity_at)
     VALUES (?, ?, 't', 0, ?)`,
  )
  session.run("s-old", "/a/current", 10)
  session.run("s-recent", "/a/current", 30)
  session.run("s-mid", "/a/current", 20)
  session.run("s-other", "/a/old", 40)

  Effect.runSync(runMigrations(db))

  expect(db.prepare("SELECT path, position, selected_session_id FROM open_projects").all()).toEqual(
    [{ path: "/a/current", position: 0, selected_session_id: "s-recent" }],
  )
  expect(db.prepare("SELECT selected_project_path FROM workspace").all()).toEqual([
    { selected_project_path: "/a/current" },
  ])
  expect(db.prepare("SELECT session_id, project_path FROM tabs ORDER BY position").all()).toEqual([
    { session_id: "s-recent", project_path: "/a/current" },
    { session_id: "s-mid", project_path: "/a/current" },
    { session_id: "s-old", project_path: "/a/current" },
  ])
})

test("a database with no project gets no open project", () => {
  const db = new DatabaseSync(":memory:")

  Effect.runSync(runMigrations(db))

  expect(db.prepare("SELECT * FROM open_projects").all()).toEqual([])
  expect(db.prepare("SELECT * FROM tabs").all()).toEqual([])
})

test("an existing session gets its project folder as its working folder, with no branch", () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db, migrations.slice(0, 6)))
  db.prepare(
    `INSERT INTO sessions (id, project_path, title, created_at, last_activity_at)
     VALUES ('s', '/a/project', 't', 0, 0)`,
  ).run()

  Effect.runSync(runMigrations(db))

  expect(db.prepare("SELECT working_folder, branch FROM sessions").all()).toEqual([
    { working_folder: "/a/project", branch: null },
  ])
})

test("a session already stored counts its status as changed at its last activity", () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db, migrations.slice(0, 7)))
  db.prepare(
    `INSERT INTO sessions (id, project_path, title, created_at, last_activity_at)
     VALUES ('s1', '/p', 't', 0, 42)`,
  ).run()

  Effect.runSync(runMigrations(db))

  expect(db.prepare("SELECT status_changed_at FROM sessions").all()).toEqual([
    { status_changed_at: 42 },
  ])
})

test("a stored session gets claude's default effort and permission mode, confirmed once it started", () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db, migrations.slice(0, 10)))
  db.exec(
    `INSERT INTO sessions (id, project_path, title, model, created_at, last_activity_at)
     VALUES ('started', '/p', 't', 'opus', 7, 9), ('fresh', '/p', 't', 'opus', 8, 8);
     INSERT INTO transcript_events (id, session_id, sequence, type, at, payload)
     VALUES ('e', 'started', 1, 'user_message', 9, '{}')`,
  )

  Effect.runSync(runMigrations(db))

  expect(
    db
      .prepare(
        `SELECT id, effort, permission_mode, run_options_at, confirmed_run_options, relaunch_failure
         FROM sessions ORDER BY id`,
      )
      .all(),
  ).toEqual([
    {
      id: "fresh",
      effort: "high",
      permission_mode: "manual",
      run_options_at: 8,
      confirmed_run_options: null,
      relaunch_failure: null,
    },
    {
      id: "started",
      effort: "high",
      permission_mode: "manual",
      run_options_at: 7,
      confirmed_run_options: '{"model":"opus","effort":"high","permissionMode":"manual"}',
      relaunch_failure: null,
    },
  ])
})

test("a stored title counts as the first message's when that message holds it, else as the user's", () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db, migrations.slice(0, 17)))
  const long = `${"word ".repeat(20)}end`
  db.exec(
    `INSERT INTO sessions (id, project_path, title, title_locked, created_at, last_activity_at)
     VALUES ('fresh', '/p', 'New session', 0, 0, 0), ('message', '/p', 'Fix the bug', 1, 0, 0),
       ('cut', '/p', '${long.slice(0, 59).trimEnd()}…', 1, 0, 0), ('named', '/p', 'Mine', 1, 0, 0);
     INSERT INTO transcript_events (id, session_id, sequence, type, at, payload) VALUES
       ('e1', 'message', 1, 'user_message', 0, '{"text":"Fix the bug\\nplease"}'),
       ('e2', 'cut', 1, 'user_message', 0, '{"text":"${long}"}'),
       ('e3', 'named', 1, 'user_message', 0, '{"text":"Fix the bug"}'),
       ('e4', 'named', 2, 'user_message', 0, '{"text":"Mine"}')`,
  )

  Effect.runSync(runMigrations(db))

  expect(db.prepare("SELECT id, title_source FROM sessions ORDER BY id").all()).toEqual([
    { id: "cut", title_source: "message" },
    { id: "fresh", title_source: null },
    { id: "message", title_source: "message" },
    { id: "named", title_source: "user" },
  ])
})
