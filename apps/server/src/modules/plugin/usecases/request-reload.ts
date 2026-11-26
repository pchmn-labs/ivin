import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { logTypeErrors } from "./log-type-errors.ts"
import { PluginReloads } from "./plugin-reloads.ts"
import { UserPlugins } from "./user-plugins.ts"

// For a change on disk: the type errors are logged beside the reload, which does not wait for them.
export const requestReload = (folderName: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    const reloads = yield* PluginReloads
    yield* reloads.request(folderName)
    const folder =
      plugins === null ? undefined : (yield* plugins.folders).find((f) => f.name === folderName)
    const reading = readManifest(folder?.manifest ?? null)
    if (folder !== undefined && reading.kind === "valid") {
      yield* logTypeErrors(folder, reading.manifest.id)
    }
  })
