import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect, Stream } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { initialPlugins, loadUiHalf } from "./list-plugins.ts"
import { PluginReloads, builtinKeyId } from "./plugin-reloads.ts"
import { disabledPlugins } from "./plugin-switches.ts"
import { pluginFolders } from "./project-plugins.ts"
import { UserPlugins, type UserPluginsService } from "./user-plugins.ts"

// A reload that fails is logged and sends nothing: the version in the window keeps running.
const reloaded = (plugins: UserPluginsService, key: string, shown: Map<string, string>) =>
  Effect.gen(function* () {
    const disabled = yield* disabledPlugins
    const removed = (id: string | undefined): UserPlugin | null => {
      shown.delete(key)
      return id === undefined ? null : { _tag: "removed", id }
    }
    const builtinId = builtinKeyId(key)
    if (builtinId !== null) {
      return disabled.has(builtinId) ? removed(builtinId) : null
    }
    const folder = (yield* pluginFolders).find((candidate) => candidate.name === key)
    if (folder === undefined) return removed(shown.get(key))
    const reading = readManifest(folder.manifest)
    if (reading.kind === "valid" && disabled.has(reading.manifest.id)) {
      return removed(reading.manifest.id)
    }
    const plugin = yield* loadUiHalf(plugins, folder)
    if (plugin?._tag !== "compiled") return null
    shown.set(key, plugin.id)
    return plugin
  })

// Every plugin once, then each plugin again whenever it reloads, until the subscriber leaves.
export const watchPlugins = Stream.unwrap(
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return Stream.empty
    const reloads = yield* PluginReloads
    // Subscribed before the first listing, so a change while the plugins compile is not missed.
    const requests = yield* reloads.subscribe
    // The id each folder shows in the window, to name what a reload removes.
    const shown = new Map<string, string>()
    for (const folder of yield* pluginFolders) {
      const reading = readManifest(folder.manifest)
      if (reading.kind === "valid" && reading.manifest.ui !== null) {
        shown.set(folder.name, reading.manifest.id)
      }
    }
    return initialPlugins(plugins).pipe(
      Stream.concat(
        requests.pipe(Stream.mapEffect(({ folder }) => reloaded(plugins, folder, shown))),
      ),
      // A plugin with only a server half has nothing for the window.
      Stream.filter((plugin) => plugin !== null),
    )
  }),
)
