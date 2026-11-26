import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect, Stream } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { PluginReloads } from "./plugin-reloads.ts"
import { reportPluginFailure } from "./report-plugin-failure.ts"
import { UserPlugins, type PluginFolder, type UserPluginsService } from "./user-plugins.ts"

const failed = (id: string, reason: string) =>
  reportPluginFailure(id, reason).pipe(Effect.as<UserPlugin>({ _tag: "failed", id, reason }))

// Null for a plugin with no UI half: it has nothing for the window.
const loadUiHalf = (
  plugins: UserPluginsService,
  folder: PluginFolder,
): Effect.Effect<UserPlugin | null> => {
  const reading = readManifest(folder.manifest)
  if (reading.kind === "invalid") return failed(folder.name, reading.reason)
  const { id, name, ui, views } = reading.manifest
  if (ui === null) return Effect.succeed(null)
  return plugins.compile({ id, path: folder.path, entry: ui, half: "ui" }).pipe(
    Effect.map((bundle): UserPlugin => ({ _tag: "compiled", id, name, bundle, views })),
    Effect.catchTag("PluginNotCompiled", ({ reason }) => failed(id, reason)),
  )
}

const initial = (plugins: UserPluginsService) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const folders = yield* plugins.folders
      const folderOfId = new Map<string, string>()
      const loads = folders.map((folder): Effect.Effect<UserPlugin | null> => {
        const reading = readManifest(folder.manifest)
        if (reading.kind === "valid") {
          const { id } = reading.manifest
          const holder = folderOfId.get(id)
          if (holder !== undefined) {
            return failed(id, `The folder ${holder} already holds a plugin with the id ${id}.`)
          }
          folderOfId.set(id, folder.name)
        }
        return loadUiHalf(plugins, folder)
      })
      return Stream.fromIterable(loads).pipe(
        Stream.mapEffect((load) => load, { concurrency: "unbounded", unordered: true }),
        // A plugin with only a server half has nothing for the window.
        Stream.filter((plugin) => plugin !== null),
      )
    }),
  )

// A reload that fails is logged and sends nothing: the version in the window keeps running.
const reloaded = (plugins: UserPluginsService, folderName: string) =>
  Effect.gen(function* () {
    const folder = (yield* plugins.folders).find((candidate) => candidate.name === folderName)
    if (folder === undefined) return null
    const plugin = yield* loadUiHalf(plugins, folder)
    return plugin?._tag === "compiled" ? plugin : null
  })

// Each plugin once, then ends: what the window starts from.
export const listPlugins = Stream.unwrap(
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    return plugins === null ? Stream.empty : initial(plugins)
  }),
)

// Every plugin once, then each plugin again whenever it reloads, until the subscriber leaves.
export const watchPlugins = Stream.unwrap(
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return Stream.empty
    const reloads = yield* PluginReloads
    // Subscribed before the first listing, so a change while the plugins compile is not missed.
    const requests = yield* reloads.subscribe
    return initial(plugins).pipe(
      Stream.concat(requests.pipe(Stream.mapEffect(({ folder }) => reloaded(plugins, folder)))),
      // A plugin with only a server half has nothing for the window.
      Stream.filter((plugin) => plugin !== null),
    )
  }),
)
