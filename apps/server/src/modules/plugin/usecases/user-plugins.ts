import type { PluginNotLocked } from "@ivin/contracts/plugin"
import type { Effect, Stream } from "effect"
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

export class PluginNotChecked extends Data.TaggedError("PluginNotChecked")<{
  readonly reason: string
}> {}

export class PluginNotMade extends Data.TaggedError("PluginNotMade")<{
  readonly reason: string
}> {}

export interface UserPluginsService {
  readonly folders: Effect.Effect<ReadonlyArray<PluginFolder>>
  // The names of the plugin folders whose files changed, once per burst of changes; a folder that appears counts.
  readonly changes: Stream.Stream<string>
  // The bundle's file name in the cache, compiled only when the folder's files changed.
  readonly compile: (plugin: {
    readonly id: string
    readonly path: string
    readonly entry: string
    readonly half: "ui" | "server"
  }) => Effect.Effect<string, PluginNotCompiled>
  readonly bundlePath: (name: string) => string
  readonly lock: (path: string) => Effect.Effect<void, PluginNotLocked>
  readonly appendLog: (id: string, line: string) => Effect.Effect<void>
  readonly readLog: (id: string) => Effect.Effect<ReadonlyArray<string>>
  // The type errors of the plugin's sources against its tsconfig.json, one line each.
  readonly check: (path: string) => Effect.Effect<ReadonlyArray<string>, PluginNotChecked>
  // Writes the starting files of a plugin in its own new folder and returns the folder's path.
  readonly create: (id: string) => Effect.Effect<string, PluginNotMade>
}

// Null when the server runs without a plugins folder: no user plugin loads.
export const UserPlugins = Context.Reference<UserPluginsService | null>("ivin/server/UserPlugins", {
  defaultValue: () => null,
})
