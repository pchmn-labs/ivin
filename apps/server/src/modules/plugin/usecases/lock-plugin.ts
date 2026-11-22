import { PluginNotFound } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { UserPlugins } from "./user-plugins.ts"

export const lockPlugin = (id: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return yield* new PluginNotFound({ id })
    const folders = yield* plugins.folders
    const folder = folders.find((candidate) => {
      const reading = readManifest(candidate.manifest)
      return reading.kind === "valid" && reading.manifest.id === id
    })
    if (folder === undefined) return yield* new PluginNotFound({ id })
    yield* plugins.lock(folder.path)
  })
