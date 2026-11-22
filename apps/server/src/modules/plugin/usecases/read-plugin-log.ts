import { Effect } from "effect"
import { UserPlugins } from "./user-plugins.ts"

export const readPluginLog = (id: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    return plugins === null ? [] : yield* plugins.readLog(id)
  })
