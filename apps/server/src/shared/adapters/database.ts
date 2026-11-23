import { Context, Effect, Layer } from "effect"
import { DatabaseSync, type StatementSync } from "node:sqlite"
import { migrations, runMigrations, type Migration } from "./migrations.ts"

export class Database extends Context.Service<Database, DatabaseSync>()("ivin/server/Database") {}

// Some SQL is built per call (variable lists), so the cache must not grow without bound.
const STATEMENT_CACHE_SIZE = 256

const cachePreparedStatements = (db: DatabaseSync) => {
  const prepare = db.prepare.bind(db)
  const cache = new Map<string, StatementSync>()
  db.prepare = (sql: string) => {
    const cached = cache.get(sql)
    if (cached) return cached
    const statement = prepare(sql)
    if (cache.size >= STATEMENT_CACHE_SIZE) cache.delete(cache.keys().next().value as string)
    cache.set(sql, statement)
    return statement
  }
}

export const layerDatabase = (path: string, known: readonly Migration[] = migrations) =>
  Layer.effect(Database)(
    Effect.acquireRelease(
      Effect.sync(() => {
        const db = new DatabaseSync(path)
        db.exec("PRAGMA journal_mode = WAL")
        // NORMAL under WAL can lose the last commits on power loss, never corrupt the file.
        db.exec("PRAGMA synchronous = NORMAL")
        cachePreparedStatements(db)
        return db
      }),
      (db) => Effect.sync(() => db.close()),
    ).pipe(Effect.tap((db) => runMigrations(db, known))),
  )
