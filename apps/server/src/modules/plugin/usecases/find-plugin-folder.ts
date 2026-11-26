import { PluginNotFound } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { UserPlugins } from "./user-plugins.ts"

export const findPluginFolder = (id: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return yield* new PluginNotFound({ id })
    const folder = (yield* plugins.folders).find((candidate) => {
      const reading = readManifest(candidate.manifest)
      return reading.kind === "valid" && reading.manifest.id === id
    })
    if (folder === undefined) return yield* new PluginNotFound({ id })
    return { plugins, folder }
  })
