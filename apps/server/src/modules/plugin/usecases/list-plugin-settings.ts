import { Settings, type PluginSettingDeclaration } from "@ivin/contracts/setting"
import { Effect } from "effect"
import { builtinPackages } from "../rules/builtin-packages.ts"
import { readManifest } from "../rules/manifest.ts"
import { UserPlugins } from "./user-plugins.ts"

// A plugin id that names a section of the app's own settings would shadow it, so it keeps only the
// generated placement settings, whose dotted keys cannot clash with the section's.
const reserved = new Set(Object.keys(Settings.fields))

// Each plugin's declarations by id; a user plugin replaces the built-in one with its id, settings included.
export const listPluginSettings = Effect.gen(function* () {
  const byId = new Map<string, ReadonlyArray<PluginSettingDeclaration>>()
  const add = (text: string | null) => {
    const reading = readManifest(text)
    if (reading.kind !== "valid") return
    const { id, settings } = reading.manifest
    byId.set(id, reserved.has(id) ? settings.filter(({ key }) => key.includes(".")) : settings)
  }
  builtinPackages.forEach(add)
  const plugins = yield* UserPlugins
  if (plugins !== null) (yield* plugins.folders).forEach((folder) => add(folder.manifest))
  return [...byId.values()].flat()
})
