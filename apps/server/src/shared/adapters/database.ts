import { Context, Effect, Layer } from "effect"
import { DatabaseSync } from "node:sqlite"
import { migrations, runMigrations, type Migration } from "./migrations.ts"

export class Database extends Context.Service<Database, DatabaseSync>()("ivin/server/Database") {}

export const layerDatabase = (path: string, list: readonly Migration[] = migrations) =>
  Layer.effect(Database)(
    Effect.acquireRelease(
      Effect.sync(() => {
        const db = new DatabaseSync(path)
        db.exec("PRAGMA journal_mode = WAL")
        return db
      }),
      (db) => Effect.sync(() => db.close()),
    ).pipe(Effect.tap((db) => runMigrations(db, list))),
  )
