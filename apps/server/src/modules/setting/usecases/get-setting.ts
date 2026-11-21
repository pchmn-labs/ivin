import { SettingPathUnknown } from "@ivin/contracts/setting"
import { Effect, type Schema } from "effect"
import { settingPaths, valueAt } from "../rules/setting-path.ts"
import { CurrentSettings } from "./current-settings.ts"

export const getSetting = (path: string | null) =>
  Effect.gen(function* () {
    const value = valueAt(yield* (yield* CurrentSettings).get, path)
    if (path === null || value !== undefined) return value as Schema.Json
    return yield* new SettingPathUnknown({ path, knownPaths: settingPaths })
  })
