import { PluginCheckFailed } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { findPluginFolder } from "./find-plugin-folder.ts"

export const checkPlugin = (id: string) =>
  Effect.gen(function* () {
    const { plugins, folder } = yield* findPluginFolder(id)
    return yield* plugins
      .check(folder.path)
      .pipe(Effect.mapError(({ reason }) => new PluginCheckFailed({ reason })))
  })
