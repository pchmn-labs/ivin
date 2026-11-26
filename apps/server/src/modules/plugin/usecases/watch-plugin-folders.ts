import { Effect, Stream } from "effect"
import { requestReload } from "./request-reload.ts"
import { UserPlugins } from "./user-plugins.ts"

// Reloads a plugin each time its folder changes, until the scope closes.
export const watchPluginFolders = Effect.gen(function* () {
  const plugins = yield* UserPlugins
  if (plugins === null) return
  yield* plugins.changes.pipe(
    Stream.mapEffect(requestReload, { concurrency: "unbounded" }),
    Stream.runDrain,
  )
})
