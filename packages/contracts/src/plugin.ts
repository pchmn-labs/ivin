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

export const PluginRpcs = RpcGroup.make(
  Rpc.make("plugin.list", { success: Schema.Array(UserPlugin) }),
  Rpc.make("plugin.reportFailure", {
    payload: { id: Schema.String, reason: Schema.String },
  }),
  // Oldest first; empty when the plugin never failed.
  Rpc.make("plugin.readLog", {
    payload: { id: Schema.String },
    success: Schema.Array(Schema.String),
  }),
)
