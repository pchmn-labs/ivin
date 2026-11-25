import type { PluginHalfState, PluginStatus } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { PluginHost } from "./plugin-host.ts"
import { ServerHalves } from "./server-halves.ts"
import { UserPlugins } from "./user-plugins.ts"

export const listPluginStatus = Effect.gen(function* () {
  const plugins = yield* UserPlugins
  if (plugins === null) return []
  const host = yield* PluginHost
  const halves = yield* ServerHalves
  const folders = yield* plugins.folders
  const statuses: PluginStatus[] = []
  for (const folder of folders) {
    const reading = readManifest(folder.manifest)
    if (reading.kind === "invalid") {
      statuses.push({ id: folder.name, name: folder.name, ui: "failed", server: "failed" })
      continue
    }
    const { id, name, ui, server } = reading.manifest
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
  return statuses
})
