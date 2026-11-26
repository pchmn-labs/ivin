import type { PluginNotLocked } from "@ivin/contracts/plugin"
import type { Effect, Stream } from "effect"
import { Context, Data } from "effect"
import type { PluginTree } from "../rules/plugin-diff.ts"

export class PluginNotCompiled extends Data.TaggedError("PluginNotCompiled")<{
  readonly reason: string
}> {}

export interface PluginFolder {
  // Names the folder to the reload machinery: a user plugin's folder name, a project plugin's path.
  readonly name: string
  // What a failure is reported under when the manifest names no id; `name` when absent.
  readonly label?: string
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
  // The plugin folders directly under `root`, which may be a project's `.ivin/plugins`.
  readonly foldersIn: (root: string) => Effect.Effect<ReadonlyArray<PluginFolder>>
  // The names of the plugin folders under a project's `.ivin/plugins` whose files changed; while it does not exist, waits for it and then names each plugin it holds.
  readonly projectChanges: (project: string) => Stream.Stream<string>
  // The files of a plugin folder and the hash of their content; null when the folder is gone.
  readonly readTree: (path: string) => Effect.Effect<{ hash: string; files: PluginTree } | null>
  // Copies the files aside and keeps the copy under `hash` only if the copy itself hashes to it; null otherwise. The copy's folder is what runs.
  readonly keepTrusted: (hash: string, path: string) => Effect.Effect<string | null>
  // The kept copy of a trusted version; null when it is gone or its files no longer hash to `hash`.
  readonly trustedFolder: (hash: string) => Effect.Effect<string | null>
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
