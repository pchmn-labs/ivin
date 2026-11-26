import { Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { PluginStorage } from "../usecases/plugin-storage.ts"

export const layerSqlitePluginStorage = Layer.effect(PluginStorage)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      get: (plugin, key) =>
        Effect.sync(() => {
          const row = db
            .prepare("SELECT value FROM plugin_storage WHERE plugin = ? AND key = ?")
            .get(plugin, key) as { value: string } | undefined
          return row === undefined ? undefined : JSON.parse(row.value)
        }),
      set: (plugin, key, value) =>
        Effect.sync(() => {
          db.prepare(
            `INSERT INTO plugin_storage (plugin, key, value) VALUES (?, ?, ?)
             ON CONFLICT (plugin, key) DO UPDATE SET value = excluded.value`,
          ).run(plugin, key, JSON.stringify(value))
        }),
    }
  }),
)
