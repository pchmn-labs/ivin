import type { PluginStatus } from "@ivin/contracts/plugin"
import { Duration, Effect, Stream } from "effect"
import { logTypeErrors } from "./check-plugin.ts"
import { findPluginFolder } from "./find-plugin-folder.ts"
import { listPluginStatus } from "./list-plugin-status.ts"
import { PluginHost } from "./plugin-host.ts"
import { PluginReloads } from "./plugin-reloads.ts"
import { readManifest } from "../rules/manifest.ts"
import { UserPlugins } from "./user-plugins.ts"

const HOST_ANSWER_WITHIN = Duration.seconds(10)

// For a change on disk: the type errors are logged beside the reload, which does not wait for them.
export const requestReload = (folderName: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    const reloads = yield* PluginReloads
    yield* reloads.request(folderName)
    const folder =
      plugins === null ? undefined : (yield* plugins.folders).find((f) => f.name === folderName)
    const reading = readManifest(folder?.manifest ?? null)
    if (folder !== undefined && reading.kind === "valid") {
      yield* logTypeErrors(folder, reading.manifest.id)
    }
  })

// For `ivin plugin reload`: returns once the server half has been swapped and the types checked.
export const reloadPlugin = (id: string) =>
  Effect.gen(function* () {
    const { folder } = yield* findPluginFolder(id)
    const reloads = yield* PluginReloads
    const host = yield* PluginHost
    const reading = readManifest(folder.manifest)
    const hasServerHalf = reading.kind === "valid" && reading.manifest.server !== null
    const completed = yield* reloads.subscribeCompleted
    yield* reloads.request(folder.name, true)
    yield* logTypeErrors(folder, id)
    if (host !== null && hasServerHalf) {
      yield* completed.pipe(
        Stream.filter((name) => name === folder.name),
        Stream.runHead,
        Effect.timeoutOption(HOST_ANSWER_WITHIN),
      )
    }
    const statuses = yield* listPluginStatus
    return statuses.find((status) => status.id === id) as PluginStatus
  }).pipe(Effect.scoped)
