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
