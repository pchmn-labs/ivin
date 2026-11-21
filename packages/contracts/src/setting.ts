import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const Settings = Schema.Struct({
  tabs: Schema.Struct({ stopAgentOnClose: Schema.Boolean }),
  worktrees: Schema.Struct({ removeOnTabClose: Schema.Boolean }),
})
export type Settings = typeof Settings.Type

export const defaultSettings: Settings = {
  tabs: { stopAgentOnClose: true },
  worktrees: { removeOnTabClose: true },
}

export const SettingsFileProblem = Schema.Struct({
  reason: Schema.Literals(["notJson", "notAnObject", "invalidSetting"]),
  // The dotted path of the invalid setting, such as "tabs.stopAgentOnClose".
  setting: Schema.NullOr(Schema.String),
})
export type SettingsFileProblem = typeof SettingsFileProblem.Type

// While the file is invalid, `settings` stays its last valid content.
export const UserSettings = Schema.Struct({
  settings: Settings,
  problem: Schema.NullOr(SettingsFileProblem),
})
export type UserSettings = typeof UserSettings.Type

export class SettingPathUnknown extends Schema.TaggedError<SettingPathUnknown>()(
  "SettingPathUnknown",
  { path: Schema.String, knownPaths: Schema.Array(Schema.String) },
) {}

export class SettingValueInvalid extends Schema.TaggedError<SettingValueInvalid>()(
  "SettingValueInvalid",
  { path: Schema.String, expected: Schema.Literals(["boolean", "number", "string"]) },
) {}

// The file is left as it is: an edit would build on text ivin cannot read.
export class SettingsFileInvalid extends Schema.TaggedError<SettingsFileInvalid>()(
  "SettingsFileInvalid",
  {
    path: Schema.String,
    reason: Schema.Literals(["notJson", "notAnObject"]),
    // The first parse error, such as "CommaExpected"; lines and columns start at 1.
    parseError: Schema.NullOr(
      Schema.Struct({ code: Schema.String, line: Schema.Number, column: Schema.Number }),
    ),
  },
) {}

export const SettingRpcs = RpcGroup.make(
  Rpc.make("setting.watch", { success: UserSettings, stream: true }),
  // The settings in use, or the value or section at a dotted path such as "tabs".
  Rpc.make("setting.get", {
    payload: { path: Schema.NullOr(Schema.String) },
    success: Schema.Json,
    error: SettingPathUnknown,
  }),
  Rpc.make("setting.set", {
    payload: { path: Schema.String, value: Schema.Json },
    error: Schema.Union([SettingPathUnknown, SettingValueInvalid, SettingsFileInvalid]),
  }),
)
