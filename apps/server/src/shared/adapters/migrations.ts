import { Data, Effect } from "effect"
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

export const runMigrations = (db: DatabaseSync, list: readonly Migration[] = migrations) =>
  Effect.try({
    try: () => {
      db.exec("CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)")
      const row = db.prepare("SELECT MAX(version) AS version FROM migrations").get() as {
        version: number | null
      }
      const databaseVersion = row.version ?? 0
      const knownVersion = Math.max(0, ...list.map((m) => m.version))
      if (databaseVersion > knownVersion) {
        return new DatabaseSchemaTooNew({ databaseVersion, knownVersion })
      }
      const pending = list
        .filter((m) => m.version > databaseVersion)
        .toSorted((a, b) => a.version - b.version)
      db.exec("BEGIN")
      try {
        for (const m of pending) {
          db.exec(m.sql)
          db.prepare("INSERT INTO migrations (version) VALUES (?)").run(m.version)
        }
        db.exec("COMMIT")
      } catch (error) {
        db.exec("ROLLBACK")
        throw error
      }
      return undefined
    },
    catch: (error) => error,
  }).pipe(
    Effect.orDie,
    Effect.flatMap((tooNew) => (tooNew ? Effect.fail(tooNew) : Effect.void)),
  )
