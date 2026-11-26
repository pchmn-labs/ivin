import { Effect } from "effect"
import { reportPluginFailure } from "./report-plugin-failure.ts"
import { UserPlugins, type PluginFolder } from "./user-plugins.ts"

// What each plugin's last check wrote, so a save that changes no error adds nothing to the log.
const lastErrors = new Map<string, string>()

// A reload loads the plugin whatever its types say: the errors only go to its log.
export const logTypeErrors = (folder: PluginFolder, id: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return
    const errors = yield* plugins.check(folder.path).pipe(
      // A plugin with no tsconfig.json has opted out of the check.
      Effect.catchTag("PluginNotChecked", () => Effect.succeed<ReadonlyArray<string>>([])),
    )
    const written = errors.join("\n")
    if (lastErrors.get(id) === written) return
    lastErrors.set(id, written)
    for (const error of errors) yield* reportPluginFailure(id, `type error: ${error}`)
  })
