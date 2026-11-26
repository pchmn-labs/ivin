import { PluginNotFound } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { logTypeErrors } from "./log-type-errors.ts"
import { findPluginFolder } from "./find-plugin-folder.ts"
import { listPluginStatus } from "./list-plugin-status.ts"
import { PluginHost } from "./plugin-host.ts"
import { readManifest } from "../rules/manifest.ts"
import { reloadFolders } from "./reload-folders.ts"

// For `ivin plugin reload`: returns once the server half has been swapped and the types checked.
export const reloadPlugin = (id: string) =>
  Effect.gen(function* () {
    const { folder } = yield* findPluginFolder(id)
    const host = yield* PluginHost
    const reading = readManifest(folder.manifest)
    const hasServerHalf = reading.kind === "valid" && reading.manifest.server !== null
    yield* reloadFolders([folder.name], host !== null && hasServerHalf)
    yield* logTypeErrors(folder, id)
    const status = (yield* listPluginStatus).find((candidate) => candidate.id === id)
    if (status === undefined) return yield* new PluginNotFound({ id })
    return status
  })
