import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const Settings = Schema.Struct({
  tabs: Schema.Struct({ stopAgentOnClose: Schema.Boolean }),
  worktrees: Schema.Struct({ removeOnTabClose: Schema.Boolean }),
  files: Schema.Struct({ folderIcons: Schema.Boolean }),
})
export type Settings = typeof Settings.Type

export const defaultSettings: Settings = {
  tabs: { stopAgentOnClose: true },
  worktrees: { removeOnTabClose: true },
  files: { folderIcons: true },
}

export type SettingPath = {
  [Section in keyof Settings]: `${Section}.${keyof Settings[Section] & string}`
}[keyof Settings]

export interface SettingSection {
  readonly key: keyof Settings
  readonly title: string
  readonly description: string
  readonly settings: ReadonlyArray<{
    readonly path: SettingPath
    readonly label: string
    readonly description: string
  }>
}

export const settingSections: ReadonlyArray<SettingSection> = [
  {
    key: "tabs",
    title: "Tabs",
    description: "What happens when you close a session's tab.",
    settings: [
      {
        path: "tabs.stopAgentOnClose",
        label: "Stop the agent when its tab closes",
        description:
          "Closing the tab of a working session asks first, then stops its agent. Off, the agent keeps working with no tab open.",
      },
    ],
  },
  {
    key: "worktrees",
    title: "Worktrees",
    description: "The worktrees ivin makes for your sessions.",
    settings: [
      {
        path: "worktrees.removeOnTabClose",
        label: "Remove a merged worktree when its tab closes",
        description:
          "Closing a session's tab deletes its worktree once the branch is merged and nothing in it is left uncommitted. Off, worktrees stay until you remove them.",
      },
    ],
  },
  {
    key: "files",
    title: "Files",
    description: "The tree of the Files tab.",
    settings: [
      {
        path: "files.folderIcons",
        label: "Show folder icons",
        description:
          "Folders show the icon theme's icon for their name, open or closed. Off, a folder shows only its chevron and its name.",
      },
    ],
  },
]

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
