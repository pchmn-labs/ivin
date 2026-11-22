import { DateTime, Effect } from "effect"
import { UserPlugins } from "./user-plugins.ts"

export const reportPluginFailure = (id: string, reason: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return
    const now = yield* DateTime.now
    yield* plugins.appendLog(id, `${DateTime.formatIso(now)} ${reason}`)
  })
