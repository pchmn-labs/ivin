import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect, Stream } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { disabledPlugins } from "./plugin-switches.ts"
import { pluginFolders } from "./project-plugins.ts"
import { reportPluginFailure } from "./report-plugin-failure.ts"
import { UiHalfPermissions } from "./ui-half-permissions.ts"
import { UserPlugins, type PluginFolder, type UserPluginsService } from "./user-plugins.ts"

const failed = (id: string, reason: string) =>
  reportPluginFailure(id, reason).pipe(Effect.as<UserPlugin>({ _tag: "failed", id, reason }))

// Null for a plugin with no UI half: it has nothing for the window.
export const loadUiHalf = (
  plugins: UserPluginsService,
  folder: PluginFolder,
): Effect.Effect<UserPlugin | null, never, UiHalfPermissions> => {
  const reading = readManifest(folder.manifest)
  if (reading.kind === "invalid") return failed(folder.label ?? folder.name, reading.reason)
  const { id, name, ui, views, permissions } = reading.manifest
  if (ui === null) return Effect.succeed(null)
  return plugins.compile({ id, path: folder.path, entry: ui, half: "ui" }).pipe(
    Effect.tap(() =>
      Effect.flatMap(UiHalfPermissions, (known) =>
        Effect.sync(() => known.set(id, "folder", permissions)),
      ),
    ),
    Effect.map((bundle): UserPlugin => ({ _tag: "compiled", id, name, bundle, views })),
    Effect.catchTag("PluginNotCompiled", ({ reason }) => failed(id, reason)),
  )
}

export const initialPlugins = (plugins: UserPluginsService) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const folders = yield* pluginFolders
      const disabled = yield* disabledPlugins
      const folderOfId = new Map<string, string>()
      const loads = folders.map(
        (folder): Effect.Effect<UserPlugin | null, never, UiHalfPermissions> => {
          const reading = readManifest(folder.manifest)
          if (reading.kind === "valid") {
            const { id } = reading.manifest
            if (disabled.has(id)) return Effect.succeed(null)
            const holder = folderOfId.get(id)
            if (holder !== undefined) {
              return failed(id, `The folder ${holder} already holds a plugin with the id ${id}.`)
            }
            folderOfId.set(id, folder.name)
          }
          return loadUiHalf(plugins, folder)
        },
      )
      return Stream.fromIterable(loads).pipe(
        Stream.mapEffect((load) => load, { concurrency: "unbounded", unordered: true }),
        Stream.filter((plugin) => plugin !== null),
      )
    }),
  )

// Each plugin once, then ends: what the window starts from.
export const listPlugins = Stream.unwrap(
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    return plugins === null ? Stream.empty : initialPlugins(plugins)
  }),
)
