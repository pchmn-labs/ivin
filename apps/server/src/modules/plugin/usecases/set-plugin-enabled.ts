import { PluginNotFound } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { BuiltinPlugins } from "./builtin-plugins.ts"
import { PluginHost } from "./plugin-host.ts"
import { builtinKey } from "./plugin-reloads.ts"
import { PluginSwitches } from "./plugin-switches.ts"
import { ProjectPluginUpdates } from "./project-plugin-updates.ts"
import { pluginFolders } from "./project-plugins.ts"
import { reloadFolders } from "./reload-folders.ts"

// Turns a plugin off or on, built-in, user or project: the window and the server half follow.
export const setPluginEnabled = (id: string, enabled: boolean) =>
  Effect.gen(function* () {
    const switches = yield* PluginSwitches
    const host = yield* PluginHost
    const folders = (yield* pluginFolders).filter((folder) => {
      const reading = readManifest(folder.manifest)
      return reading.kind === "valid" && reading.manifest.id === id
    })
    const builtin = ((yield* BuiltinPlugins)?.plugins ?? []).find((plugin) => {
      const reading = readManifest(plugin.manifest)
      return reading.kind === "valid" && reading.manifest.id === id
    })
    if (switches === null || (folders.length === 0 && builtin === undefined)) {
      return yield* new PluginNotFound({ id })
    }
    yield* switches.setEnabled(id, enabled)
    const hasServerHalf =
      builtin?.server != null ||
      folders.some((folder) => {
        const reading = readManifest(folder.manifest)
        return reading.kind === "valid" && reading.manifest.server !== null
      })
    yield* reloadFolders(
      [...folders.map((folder) => folder.name), ...(builtin === undefined ? [] : [builtinKey(id)])],
      host !== null && hasServerHalf,
    )
    yield* (yield* ProjectPluginUpdates).publish
  })
