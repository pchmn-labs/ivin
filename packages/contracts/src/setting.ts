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

export const SettingRpcs = RpcGroup.make(
  Rpc.make("setting.watch", { success: UserSettings, stream: true }),
)
