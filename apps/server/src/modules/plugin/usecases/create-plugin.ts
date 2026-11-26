import { PluginNotCreated } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { isPluginId } from "../rules/manifest.ts"
import { readManifest } from "../rules/manifest.ts"
import { UserPlugins } from "./user-plugins.ts"

export const createPlugin = (id: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null)
      return yield* new PluginNotCreated({ reason: "ivin has no plugins folder." })
    if (!isPluginId(id)) {
      return yield* new PluginNotCreated({
        reason: "A plugin id is lowercase letters, digits and dashes.",
      })
    }
    for (const folder of yield* plugins.folders) {
      const reading = readManifest(folder.manifest)
      if (folder.name === id || (reading.kind === "valid" && reading.manifest.id === id)) {
        return yield* new PluginNotCreated({
          reason: `The folder ${folder.name} already holds a plugin with the id ${id}.`,
        })
      }
    }
    return yield* plugins
      .create(id)
      .pipe(Effect.mapError(({ reason }) => new PluginNotCreated({ reason })))
  })
