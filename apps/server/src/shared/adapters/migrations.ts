import { Data, Effect, Exit } from "effect"
import type { DatabaseSync } from "node:sqlite"

export interface Migration {
  readonly version: number
  readonly sql: string
}

export class DatabaseSchemaTooNew extends Data.TaggedError("DatabaseSchemaTooNew")<{
  readonly databaseVersion: number
  readonly knownVersion: number
}> {
  override get message() {
    return `The database is at schema version ${this.databaseVersion}, but this build of ivin only knows up to version ${this.knownVersion}. It was written by a newer version of ivin: update ivin to open it.`
  }
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    sql: `CREATE TABLE projects (
      path TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      last_opened_at INTEGER NOT NULL
    )`,
  },
  {
    version: 2,
    sql: `CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      title TEXT NOT NULL,
      title_locked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL
    );
    CREATE INDEX sessions_by_project ON sessions (project_path, last_activity_at DESC);
    CREATE TABLE transcript_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions (id),
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      at INTEGER NOT NULL,
      payload TEXT NOT NULL,
      UNIQUE (session_id, sequence)
    )`,
  },
  {
    version: 3,
    sql: "ALTER TABLE sessions ADD COLUMN model TEXT NOT NULL DEFAULT 'sonnet'",
  },
  {
    version: 4,
    sql: "ALTER TABLE sessions ADD COLUMN provider_session_id TEXT",
  },
]

const inTransaction = <A, E>(db: DatabaseSync, body: Effect.Effect<A, E>) =>
  Effect.sync(() => db.exec("BEGIN IMMEDIATE")).pipe(
    Effect.andThen(
      body.pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => db.exec(Exit.isSuccess(exit) ? "COMMIT" : "ROLLBACK")),
        ),
      ),
    ),
  )

export const runMigrations = (db: DatabaseSync, known: readonly Migration[] = migrations) =>
  inTransaction(
    db,
    Effect.gen(function* () {
      db.exec("CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)")
      const row = db.prepare("SELECT MAX(version) AS version FROM migrations").get() as {
        version: number | null
      }
      const databaseVersion = row.version ?? 0
      const knownVersion = Math.max(0, ...known.map((migration) => migration.version))
      if (databaseVersion > knownVersion) {
        return yield* new DatabaseSchemaTooNew({ databaseVersion, knownVersion })
      }
      const pending = known
        .filter((migration) => migration.version > databaseVersion)
        .toSorted((a, b) => a.version - b.version)
      for (const migration of pending) {
        db.exec(migration.sql)
        db.prepare("INSERT INTO migrations (version) VALUES (?)").run(migration.version)
      }
    }),
  )
