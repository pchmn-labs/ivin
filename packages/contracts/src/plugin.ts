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
])
export type UserPlugin = typeof UserPlugin.Type

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
  Rpc.make("plugin.reportFailure", { payload: PluginFailure }),
  // Oldest first; empty when the plugin never failed.
  Rpc.make("plugin.readLog", {
    payload: { id: Schema.String },
    success: Schema.Array(Schema.String),
  }),
  Rpc.make("plugin.status", { success: Schema.Array(PluginStatus) }),
  Rpc.make("plugin.lock", {
    payload: { id: Schema.String },
    error: Schema.Union([PluginNotFound, PluginNotLocked]),
  }),
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
)
