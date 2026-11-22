import { Context, Data, Effect } from "effect"

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
  readonly compile: (folder: string, entry: string) => Effect.Effect<string, PluginNotCompiled>
  readonly appendLog: (id: string, line: string) => Effect.Effect<void>
  readonly readLog: (id: string) => Effect.Effect<ReadonlyArray<string>>
}

// Null when the server runs without a plugins folder: no user plugin loads.
export const UserPlugins = Context.Reference<UserPluginsService | null>("ivin/server/UserPlugins", {
  defaultValue: () => null,
})
