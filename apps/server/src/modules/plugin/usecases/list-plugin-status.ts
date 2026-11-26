import type { PluginHalfState, PluginStatus } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { BuiltinPlugins } from "./builtin-plugins.ts"
import { PluginHost } from "./plugin-host.ts"
import { disabledPlugins } from "./plugin-switches.ts"
import { pluginFolders } from "./project-plugins.ts"
import { ServerHalves } from "./server-halves.ts"
import { UserPlugins } from "./user-plugins.ts"

export const listPluginStatus = Effect.gen(function* () {
  const plugins = yield* UserPlugins
  if (plugins === null) return []
  const host = yield* PluginHost
  const halves = yield* ServerHalves
  const disabled = yield* disabledPlugins
  const folders = yield* pluginFolders
  const statuses: PluginStatus[] = []
  for (const folder of folders) {
    const reading = readManifest(folder.manifest)
    if (reading.kind === "invalid") {
      const id = folder.label ?? folder.name
      statuses.push({ id, name: id, ui: "failed", server: "failed" })
      continue
    }
    const { id, name, ui, server } = reading.manifest
    if (disabled.has(id)) {
      statuses.push({ id, name, ui: "disabled", server: "disabled" })
      continue
    }
    const uiState: PluginHalfState =
      ui === null
        ? "none"
        : yield* plugins.compile({ id, path: folder.path, entry: ui, half: "ui" }).pipe(
            Effect.as<PluginHalfState>("active"),
            Effect.catchTag("PluginNotCompiled", () => Effect.succeed<PluginHalfState>("failed")),
          )
    // Without a plugin host the half never runs.
    const serverState: PluginHalfState =
      server === null
        ? "none"
        : ((yield* halves.get(id)) ?? (host === null ? "disabled" : "failed"))
    statuses.push({ id, name, ui: uiState, server: serverState })
  }
  // A disabled built-in plugin is listed so it can be turned on; an active one is not.
  const listed = new Set(statuses.map(({ id }) => id))
  for (const builtin of (yield* BuiltinPlugins)?.plugins ?? []) {
    const reading = readManifest(builtin.manifest)
    if (reading.kind !== "valid") continue
    const { id, name } = reading.manifest
    if (disabled.has(id) && !listed.has(id)) {
      statuses.push({ id, name, ui: "disabled", server: "disabled" })
    }
  }
  return statuses
})
