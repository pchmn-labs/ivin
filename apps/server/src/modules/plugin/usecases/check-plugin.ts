import { PluginCheckFailed } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { reportPluginFailure } from "./report-plugin-failure.ts"
import { findPluginFolder } from "./find-plugin-folder.ts"
import { UserPlugins, type PluginFolder } from "./user-plugins.ts"

export const checkPlugin = (id: string) =>
  Effect.gen(function* () {
    const { plugins, folder } = yield* findPluginFolder(id)
    return yield* plugins
      .check(folder.path)
      .pipe(Effect.mapError(({ reason }) => new PluginCheckFailed({ reason })))
  })

// A reload loads the plugin whatever its types say: the errors only go to its log.
export const logTypeErrors = (folder: PluginFolder, id: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return
    const errors = yield* plugins.check(folder.path).pipe(
      // A plugin with no tsconfig.json has opted out of the check.
      Effect.catchTag("PluginNotChecked", () => Effect.succeed<ReadonlyArray<string>>([])),
    )
    for (const error of errors) yield* reportPluginFailure(id, `type error: ${error}`)
  })
