import { PluginNotFound } from "@ivin/contracts/plugin"
import { Duration, Effect, Stream } from "effect"
import { logTypeErrors } from "./log-type-errors.ts"
import { findPluginFolder } from "./find-plugin-folder.ts"
import { listPluginStatus } from "./list-plugin-status.ts"
import { PluginHost } from "./plugin-host.ts"
import { PluginReloads } from "./plugin-reloads.ts"
import { readManifest } from "../rules/manifest.ts"

const HOST_ANSWER_WITHIN = Duration.seconds(10)

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
    const status = (yield* listPluginStatus).find((candidate) => candidate.id === id)
    if (status === undefined) return yield* new PluginNotFound({ id })
    return status
  }).pipe(Effect.scoped)
