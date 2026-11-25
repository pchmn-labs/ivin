import {
  SettingPathUnknown,
  SettingsFileInvalid,
  SettingValueInvalid,
} from "@ivin/contracts/setting"
import { Effect, type Schema } from "effect"
import { editSettingsText } from "../rules/edit-settings-text.ts"
import { checkPluginSetting, pluginSettingPaths } from "../rules/plugin-settings.ts"
import { checkSetting, settingPaths } from "../rules/setting-path.ts"
import { PluginSettingDeclarations } from "./plugin-setting-declarations.ts"
import { SettingsFile } from "./settings-file.ts"

export const setSetting = (path: string, value: Schema.Json) =>
  Effect.gen(function* () {
    const declarations = yield* yield* PluginSettingDeclarations
    const core = checkSetting(path, value)
    const check =
      core.ok || core.reason === "invalidValue"
        ? core
        : (checkPluginSetting(declarations, path, value) ?? core)
    if (!check.ok) {
      return yield* check.reason === "unknownPath"
        ? new SettingPathUnknown({
            path,
            knownPaths: [...settingPaths, ...pluginSettingPaths(declarations)],
          })
        : new SettingValueInvalid({
            path,
            expected: check.expected,
            ...(check.allowed !== undefined && { allowed: check.allowed }),
          })
    }
    const file = yield* SettingsFile
    yield* file.edit((text) => {
      const edited = editSettingsText(text, path, value)
      return edited.ok
        ? Effect.succeed(edited.text)
        : Effect.fail(
            new SettingsFileInvalid({
              path: file.path,
              reason: edited.reason,
              parseError: edited.parseError,
            }),
          )
    })
  })
