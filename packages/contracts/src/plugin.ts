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

export const UserPlugin = Schema.Union([
  // `bundle` is the file name of the compiled UI half in ivin's plugin cache.
  Schema.TaggedStruct("compiled", {
    id: Schema.String,
    name: Schema.String,
    bundle: Schema.String,
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

export const PluginRpcs = RpcGroup.make(
  // Each plugin as soon as it is compiled or failed: one whose dependencies install comes last.
  Rpc.make("plugin.list", { success: UserPlugin, stream: true }),
  Rpc.make("plugin.reportFailure", { payload: PluginFailure }),
  // Oldest first; empty when the plugin never failed.
  Rpc.make("plugin.readLog", {
    payload: { id: Schema.String },
    success: Schema.Array(Schema.String),
  }),
  // Writes the plugin's pnpm-lock.yaml from the dependencies in its package.json.
  Rpc.make("plugin.lock", {
    payload: { id: Schema.String },
    error: Schema.Union([PluginNotFound, PluginNotLocked]),
  }),
)
