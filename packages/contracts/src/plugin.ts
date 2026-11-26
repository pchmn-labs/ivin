import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

// The app's own instances, which a plugin's bundle reads from `HOST_MODULES_GLOBAL` on `globalThis`.
export const HOST_MODULES = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "@ivin/plugin-api/ui",
  "@ivin/plugin-api/editor",
] as const
export type HostModule = (typeof HOST_MODULES)[number]
export const HOST_MODULES_GLOBAL = "__ivinHostModules"

// The plugin host's own instances, which a server half's bundle reads from `HOST_MODULES_GLOBAL`.
export const SERVER_HOST_MODULES = ["@ivin/plugin-api/server"] as const

export const ViewPlacement = Schema.Literals(["subView", "sheet", "dialog"])
export type ViewPlacement = typeof ViewPlacement.Type

// A view a plugin's manifest declares under `ivin.views`.
export const ViewDeclaration = Schema.Struct({
  name: Schema.String,
  title: Schema.String,
  icon: Schema.String,
  placements: Schema.Array(ViewPlacement),
  defaultPlacement: ViewPlacement,
  // A sub-view that is not restored is dropped when the server starts.
  restore: Schema.Boolean,
})
export type ViewDeclaration = typeof ViewDeclaration.Type

export const UserPlugin = Schema.Union([
  // `bundle` is the file name of the compiled UI half in ivin's plugin cache.
  Schema.TaggedStruct("compiled", {
    id: Schema.String,
    name: Schema.String,
    bundle: Schema.String,
    views: Schema.Array(ViewDeclaration),
  }),
  Schema.TaggedStruct("failed", { id: Schema.String, reason: Schema.String }),
  // The plugin is gone from the window: disabled, deleted, or no longer trusted.
  Schema.TaggedStruct("removed", { id: Schema.String }),
])
export type UserPlugin = typeof UserPlugin.Type

// A file of a project plugin against the version the user trusted; every file of a plugin never trusted is `A`.
export const PluginFileChange = Schema.Struct({
  path: Schema.String,
  status: Schema.Literals(["A", "M", "D"]),
})
export type PluginFileChange = typeof PluginFileChange.Type

export const ProjectPluginState = Schema.Literals(["new", "changed", "trusted"])
export type ProjectPluginState = typeof ProjectPluginState.Type

// A plugin found in a trusted project's `.ivin/plugins/`.
export const ProjectPlugin = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  // `new`: never trusted, not running. `changed`: the trusted version runs, the files on disk wait for trust. `trusted`: the files on disk run.
  state: ProjectPluginState,
  // The hash of the files on disk, to hand back to `plugin.trust`.
  hash: Schema.String,
  files: Schema.Array(PluginFileChange),
  // Unified diff of the changed text files against the trusted version; empty for a new plugin.
  diff: Schema.String,
  // The manifest's permissions differ from the trusted version's: full trust does not cover this change.
  permissionsChanged: Schema.Boolean,
  // The permissions the manifest declares, as written.
  permissions: Schema.Array(Schema.String),
})
export type ProjectPlugin = typeof ProjectPlugin.Type

// A change that ran without a question because the project has full trust.
export const ProjectPluginChange = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  hash: Schema.String,
  // Epoch milliseconds.
  at: Schema.Number,
  isNew: Schema.Boolean,
  files: Schema.Array(PluginFileChange),
  diff: Schema.String,
  seen: Schema.Boolean,
})
export type ProjectPluginChange = typeof ProjectPluginChange.Type

export const ProjectPlugins = Schema.Struct({
  // The project's folder.
  project: Schema.String,
  projectName: Schema.String,
  // Paths the window knows the project by when they differ from `project`, which is its real path.
  openAs: Schema.Array(Schema.String),
  fullTrust: Schema.Boolean,
  plugins: Schema.Array(ProjectPlugin),
  changes: Schema.Array(ProjectPluginChange),
})
export type ProjectPlugins = typeof ProjectPlugins.Type

// The content on disk is no longer the one the caller saw: read the state again.
export class PluginContentChanged extends Schema.TaggedError<PluginContentChanged>()(
  "PluginContentChanged",
  { id: Schema.String },
) {}

// Why the window starts with plugins off, shown once by the window.
export const StartupNotice = Schema.Union([
  Schema.TaggedStruct("safeForced", {}),
  Schema.TaggedStruct("safeAfterCrash", {}),
  // `plugins`: ids the window was reloaded without after it stopped answering.
  Schema.TaggedStruct("reloadedWithout", { plugins: Schema.Array(Schema.String) }),
])
export type StartupNotice = typeof StartupNotice.Type

export const PluginFailure = Schema.Struct({ id: Schema.String, reason: Schema.String })
export type PluginFailure = typeof PluginFailure.Type

export class PluginNotFound extends Schema.TaggedError<PluginNotFound>()("PluginNotFound", {
  id: Schema.String,
}) {}

// pnpm's own message, for the plugin's author.
export class PluginNotLocked extends Schema.TaggedError<PluginNotLocked>()("PluginNotLocked", {
  reason: Schema.String,
}) {}

export const PluginHalfState = Schema.Literals(["none", "active", "failed", "disabled"])
export type PluginHalfState = typeof PluginHalfState.Type

export const PluginStatus = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  ui: PluginHalfState,
  server: PluginHalfState,
})
export type PluginStatus = typeof PluginStatus.Type

export const HostLog = Schema.Struct({ id: Schema.String, line: Schema.String })
export type HostLog = typeof HostLog.Type

export class CommandNotFound extends Schema.TaggedError<CommandNotFound>()("CommandNotFound", {
  command: Schema.String,
}) {}

export class CommandFailed extends Schema.TaggedError<CommandFailed>()("CommandFailed", {
  command: Schema.String,
  reason: Schema.String,
}) {}

// The reason is the check's own message: a plugin whose tsconfig.json cannot be read.
export class PluginCheckFailed extends Schema.TaggedError<PluginCheckFailed>()(
  "PluginCheckFailed",
  { reason: Schema.String },
) {}

export class PluginNotCreated extends Schema.TaggedError<PluginNotCreated>()("PluginNotCreated", {
  reason: Schema.String,
}) {}

export const PluginRpcs = RpcGroup.make(
  // Each plugin as soon as it is compiled or failed: one whose dependencies install comes last.
  // The stream stays open: a plugin whose files change, or that `plugin.reload` names, comes again with its new bundle, which replaces the earlier entry with its id.
  Rpc.make("plugin.list", { success: UserPlugin, stream: true }),
  // The plugins prebuilt with the app, all at once: the window starts once they are active.
  Rpc.make("plugin.listBuiltin", { success: Schema.Array(UserPlugin) }),
  Rpc.make("plugin.reportFailure", { payload: PluginFailure }),
  // Oldest first; empty when the plugin never failed.
  Rpc.make("plugin.readLog", {
    payload: { id: Schema.String },
    success: Schema.Array(Schema.String),
  }),
  Rpc.make("plugin.status", { success: Schema.Array(PluginStatus) }),
  // Turns a plugin off or on, also for the window and server half that run; kept across relaunches.
  Rpc.make("plugin.setEnabled", {
    payload: { id: Schema.String, enabled: Schema.Boolean },
    error: PluginNotFound,
  }),
  // The plugins of every trusted project, again on each change; empty list when no project ships one.
  Rpc.make("plugin.projectPlugins", { success: Schema.Array(ProjectPlugins), stream: true }),
  Rpc.make("plugin.trust", {
    payload: { project: Schema.String, id: Schema.String, hash: Schema.String },
    error: Schema.Union([PluginNotFound, PluginContentChanged]),
  }),
  Rpc.make("plugin.setFullTrust", {
    payload: { project: Schema.String, enabled: Schema.Boolean },
  }),
  Rpc.make("plugin.markChangesSeen", { payload: { project: Schema.String } }),
  Rpc.make("plugin.lock", {
    payload: { id: Schema.String },
    error: Schema.Union([PluginNotFound, PluginNotLocked]),
  }),
  // `ivin run`: any plugin's command, with its result.
  Rpc.make("plugin.run", {
    payload: { command: Schema.String, args: Schema.Json },
    success: Schema.Json,
    error: Schema.Union([CommandNotFound, CommandFailed]),
  }),
  // Whether the window is on screen: `ctx.poll` pauses while it is not.
  Rpc.make("plugin.setWindowVisible", { payload: { visible: Schema.Boolean } }),
  // Compiles both halves again and swaps the running ones; the status is what the plugin reached.
  Rpc.make("plugin.reload", {
    payload: { id: Schema.String },
    success: PluginStatus,
    error: PluginNotFound,
  }),
  // One line per type error, `file(line,column): error TSxxxx: message`; empty when the plugin type-checks.
  Rpc.make("plugin.check", {
    payload: { id: Schema.String },
    success: Schema.Array(Schema.String),
    error: Schema.Union([PluginNotFound, PluginCheckFailed]),
  }),
  // The path of the new plugin's folder.
  Rpc.make("plugin.create", {
    payload: { id: Schema.String },
    success: Schema.String,
    error: PluginNotCreated,
  }),
)
export class PluginActivateFailed extends Schema.TaggedError<PluginActivateFailed>()(
  "PluginActivateFailed",
  { reason: Schema.String },
) {}

export class PluginHandlerFailed extends Schema.TaggedError<PluginHandlerFailed>()(
  "PluginHandlerFailed",
  { reason: Schema.String },
) {}

// A `ctx` call a server half makes: the host asks, the server answers through `pluginHost.reply`.
export const HostCall = Schema.Struct({
  callId: Schema.Number,
  // The plugin whose code made the call.
  id: Schema.String,
  method: Schema.String,
  args: Schema.Json,
})
export type HostCall = typeof HostCall.Type

export const HostReply = Schema.Struct({
  callId: Schema.Number,
  // The error's message when the call failed.
  failure: Schema.NullOr(Schema.String),
  value: Schema.Json,
})
export type HostReply = typeof HostReply.Type

// What the server tells a plugin's half happened, or asks of it.
export const HostDispatch = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals([
    "transcript",
    "sessionCreated",
    "sessionChanged",
    "settingChanged",
    "command",
    "beforeSpawn",
    "poll",
  ]),
  payload: Schema.Json,
})
export type HostDispatch = typeof HostDispatch.Type

// Spoken by the server to the plugin host over the host's own port; the host is the RPC server.
export const PluginHostRpcs = RpcGroup.make(
  // `file` is the compiled server half in ivin's plugin cache.
  Rpc.make("pluginHost.activate", {
    payload: { id: Schema.String, file: Schema.String },
    error: PluginActivateFailed,
  }),
  Rpc.make("pluginHost.deactivate", { payload: { id: Schema.String } }),
  Rpc.make("pluginHost.ping"),
  // What the plugins' halves wrote to their console and what they threw, as it happens.
  Rpc.make("pluginHost.logs", { success: HostLog, stream: true }),
  Rpc.make("pluginHost.calls", { success: HostCall, stream: true }),
  Rpc.make("pluginHost.reply", { payload: { reply: HostReply } }),
  // The result of the plugin's handler; a failure is the handler's.
  Rpc.make("pluginHost.dispatch", {
    payload: HostDispatch,
    success: Schema.Json,
    error: PluginHandlerFailed,
  }),
)
