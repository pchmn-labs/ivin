import type { PluginNotLocked } from "@ivin/contracts/plugin"
import type { Effect } from "effect"
import { Context, Data } from "effect"

export class PluginNotCompiled extends Data.TaggedError("PluginNotCompiled")<{
  readonly reason: string
}> {}

export interface PluginFolder {
  readonly name: string
  readonly path: string
  // The text of its package.json, null when it has none.
  readonly manifest: string | null
}

export interface UserPluginsService {
  readonly folders: Effect.Effect<ReadonlyArray<PluginFolder>>
  // The bundle's file name in the cache, compiled only when the folder's files changed.
  readonly compile: (plugin: {
    readonly id: string
    readonly path: string
    readonly entry: string
    readonly half: "ui" | "server"
  }) => Effect.Effect<string, PluginNotCompiled>
  // The path of a bundle `compile` named.
  readonly bundlePath: (name: string) => string
  readonly lock: (path: string) => Effect.Effect<void, PluginNotLocked>
  readonly appendLog: (id: string, line: string) => Effect.Effect<void>
  readonly readLog: (id: string) => Effect.Effect<ReadonlyArray<string>>
}

// Null when the server runs without a plugins folder: no user plugin loads.
export const UserPlugins = Context.Reference<UserPluginsService | null>("ivin/server/UserPlugins", {
  defaultValue: () => null,
})
