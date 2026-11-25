import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const Settings = Schema.Struct({
  tabs: Schema.Struct({ stopAgentOnClose: Schema.Boolean }),
  worktrees: Schema.Struct({ removeOnTabClose: Schema.Boolean }),
  files: Schema.Struct({ folderIcons: Schema.Boolean }),
  sidebar: Schema.Struct({ layout: Schema.Literals(["rail", "strip"]) }),
  agents: Schema.Struct({
    stopWhenIdleMinutes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
  updates: Schema.Struct({ automaticCheck: Schema.Boolean, beta: Schema.Boolean }),
})
export type Settings = typeof Settings.Type

export const defaultSettings: Settings = {
  tabs: { stopAgentOnClose: true },
  worktrees: { removeOnTabClose: true },
  files: { folderIcons: true },
  sidebar: { layout: "rail" },
  agents: { stopWhenIdleMinutes: 10 },
  updates: { automaticCheck: true, beta: false },
}

export const defaultSettingsFor = (version: string): Settings => ({
  ...defaultSettings,
  updates: { ...defaultSettings.updates, beta: /^\d+\.\d+\.\d+-/.test(version) },
})

const choicesOf = <Value extends string>(
  schema: { readonly literals: ReadonlyArray<Value> },
  labels: Record<Value, string>,
) => schema.literals.map((value) => ({ value, label: labels[value] }))

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
    // A setting with fixed values, in the schema's order.
    readonly choices?: ReadonlyArray<{ readonly value: string; readonly label: string }>
    // A whole number of `unit` at least `min`, typed rather than picked.
    readonly count?: { readonly min: number; readonly unit: string }
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
  {
    key: "sidebar",
    title: "Sidebar",
    description: "How the sidebar shows your open projects.",
    settings: [
      {
        path: "sidebar.layout",
        label: "Projects",
        description:
          "Rail lists the projects in a column beside the sessions. Strip names the selected project above the sessions and lines up the others at the sidebar's foot.",
        choices: choicesOf(Settings.fields.sidebar.fields.layout, {
          rail: "Rail",
          strip: "Strip",
        }),
      },
    ],
  },
  {
    key: "agents",
    title: "Agents",
    description: "How long ivin keeps a session's agent running.",
    settings: [
      {
        path: "agents.stopWhenIdleMinutes",
        label: "Stop an idle agent after",
        description:
          "An agent whose session has had no turn for this long is stopped, which ends the background commands it started; an agent that still runs background tasks is left alone. The session stays as it was, and your next message starts the agent again. 0 keeps agents running until their tab closes.",
        count: { min: 0, unit: "minutes" },
      },
    ],
  },
  {
    key: "updates",
    title: "Updates",
    description: "How ivin gets a new version of itself.",
    settings: [
      {
        path: "updates.automaticCheck",
        label: "Check for updates automatically",
        description:
          "ivin looks for a new release when it starts and every hour, downloads it in the background and replaces itself when you restart. Off, ivin sends no request until you run Check for updates.",
      },
      {
        path: "updates.beta",
        label: "Get beta versions",
        description:
          "ivin updates to the newest version, beta or not. Betas get new features first and may break. Off, ivin waits for the next stable version. On by default when the installed version is a beta.",
      },
    ],
  },
]

export const choicesText = (values: ReadonlyArray<string>): string => {
  const quoted = values.map((value) => JSON.stringify(value))
  return quoted.length < 2
    ? quoted.join("")
    : `${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}`
}

export const SettingsFileProblem = Schema.Struct({
  reason: Schema.Literals(["notJson", "notAnObject", "invalidSetting"]),
  // The dotted path of the invalid setting, such as "tabs.stopAgentOnClose".
  setting: Schema.NullOr(Schema.String),
})
export type SettingsFileProblem = typeof SettingsFileProblem.Type

export const PluginSettingValue = Schema.Union([Schema.Boolean, Schema.Number, Schema.String])
export type PluginSettingValue = typeof PluginSettingValue.Type

// A setting a plugin's manifest declares, stored in settings.json as `<pluginId>.<key>`.
export const PluginSettingDeclaration = Schema.Struct({
  pluginId: Schema.String,
  pluginName: Schema.String,
  key: Schema.String,
  type: Schema.Literals(["boolean", "number", "string"]),
  default: PluginSettingValue,
  title: Schema.String,
  description: Schema.String,
  // The allowed values of a string setting.
  values: Schema.optional(Schema.Array(Schema.String)),
})
export type PluginSettingDeclaration = typeof PluginSettingDeclaration.Type

export const PluginSetting = Schema.Struct({
  ...PluginSettingDeclaration.fields,
  value: PluginSettingValue,
  // The file holds a value of the wrong type for this setting, so `value` is the default.
  ignored: Schema.Boolean,
})
export type PluginSetting = typeof PluginSetting.Type

// While the file is invalid, `settings` stays its last valid content.
export const UserSettings = Schema.Struct({
  settings: Settings,
  // Left out by a server without plugin settings.
  pluginSettings: Schema.optionalKey(Schema.Array(PluginSetting)),
  problem: Schema.NullOr(SettingsFileProblem),
})
export type UserSettings = typeof UserSettings.Type

export class SettingPathUnknown extends Schema.TaggedError<SettingPathUnknown>()(
  "SettingPathUnknown",
  { path: Schema.String, knownPaths: Schema.Array(Schema.String) },
) {}

export class SettingValueInvalid extends Schema.TaggedError<SettingValueInvalid>()(
  "SettingValueInvalid",
  {
    path: Schema.String,
    expected: Schema.Literals(["boolean", "number", "wholeNumber", "string", "oneOf"]),
    allowed: Schema.optional(Schema.Array(Schema.String)),
  },
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

export class SettingsFileUnavailable extends Schema.TaggedError<SettingsFileUnavailable>()(
  "SettingsFileUnavailable",
  { path: Schema.String, action: Schema.Literals(["read", "write"]) },
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
    error: Schema.Union([
      SettingPathUnknown,
      SettingValueInvalid,
      SettingsFileInvalid,
      SettingsFileUnavailable,
    ]),
  }),
)
