import { Effect } from "effect"
import { logPluginFailure } from "./list-plugins.ts"
import { UserPlugins } from "./user-plugins.ts"

export const reportPluginFailure = (id: string, reason: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins !== null) yield* logPluginFailure(plugins, id, reason)
  })
