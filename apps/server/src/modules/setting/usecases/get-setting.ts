import { SettingPathUnknown } from "@ivin/contracts/setting"
import { Effect, type Schema } from "effect"
import { pluginSettingPaths, pluginSettingValues } from "../rules/plugin-settings.ts"
import { settingPaths, valueAt } from "../rules/setting-path.ts"
import { CurrentSettings } from "./current-settings.ts"
import { PluginSettingDeclarations } from "./plugin-setting-declarations.ts"

export const getSetting = (path: string | null) =>
  Effect.gen(function* () {
    const current = yield* CurrentSettings
    const declarations = yield* yield* PluginSettingDeclarations
    const core: Record<string, unknown> = { ...(yield* current.get) }
    const settings: Record<string, unknown> = { ...core }
    for (const [id, values] of Object.entries(pluginSettingValues(yield* current.pluginSettings))) {
      const own = core[id]
      settings[id] = typeof own === "object" && own !== null ? { ...own, ...values } : values
    }
    const value = valueAt(settings, path)
    if (path === null || value !== undefined) return value as Schema.Json
    return yield* new SettingPathUnknown({
      path,
      knownPaths: [...settingPaths, ...pluginSettingPaths(declarations)],
    })
  })
