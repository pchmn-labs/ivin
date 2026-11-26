import type { Schema } from "effect"
import { Context, type Effect } from "effect"

export class PluginStorage extends Context.Service<
  PluginStorage,
  {
    // Undefined when the plugin stored nothing under the key.
    readonly get: (plugin: string, key: string) => Effect.Effect<Schema.Json | undefined>
    readonly set: (plugin: string, key: string, value: Schema.Json) => Effect.Effect<void>
  }
>()("ivin/server/PluginStorage") {}
