import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { reportPluginFailure } from "./report-plugin-failure.ts"
import { UserPlugins } from "./user-plugins.ts"

export const listPlugins = Effect.gen(function* () {
  const plugins = yield* UserPlugins
  if (plugins === null) return []
  const folders = yield* plugins.folders
  const folderOfId = new Map<string, string>()
  return yield* Effect.forEach(folders, (folder): Effect.Effect<UserPlugin> => {
    const fail = (id: string, reason: string) =>
      reportPluginFailure(id, reason).pipe(Effect.as<UserPlugin>({ _tag: "failed", id, reason }))
    const reading = readManifest(folder.manifest)
    if (reading.kind === "invalid") return fail(folder.name, reading.reason)
    const { id, name, ui } = reading.manifest
    const holder = folderOfId.get(id)
    if (holder !== undefined) {
      return fail(id, `The folder ${holder} already holds a plugin with the id ${id}.`)
    }
    folderOfId.set(id, folder.name)
    return plugins.compile(folder.path, ui).pipe(
      Effect.map((bundle): UserPlugin => ({ _tag: "compiled", id, name, bundle })),
      Effect.catchTag("PluginNotCompiled", ({ reason }) => fail(id, reason)),
    )
  })
})
