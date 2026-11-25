import { Settings, type PluginSettingDeclaration } from "@ivin/contracts/setting"
import { Effect } from "effect"
import { builtinPackages } from "../rules/builtin-packages.ts"
import { readManifest } from "../rules/manifest.ts"
import { UserPlugins } from "./user-plugins.ts"

// A plugin id that names a section of the app's own settings would shadow it.
const reserved = new Set(Object.keys(Settings.fields))

// Each plugin's declarations by id; a user plugin replaces the built-in one with its id, settings included.
export const listPluginSettings = Effect.gen(function* () {
  const byId = new Map<string, ReadonlyArray<PluginSettingDeclaration>>()
  const add = (text: string | null) => {
    const reading = readManifest(text)
    if (reading.kind === "valid" && !reserved.has(reading.manifest.id)) {
      byId.set(reading.manifest.id, reading.manifest.settings)
    }
  }
  builtinPackages.forEach(add)
  const plugins = yield* UserPlugins
  if (plugins !== null) (yield* plugins.folders).forEach((folder) => add(folder.manifest))
  return [...byId.values()].flat()
})
