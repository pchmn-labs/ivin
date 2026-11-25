import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect, Stream } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { reportPluginFailure } from "./report-plugin-failure.ts"
import { UserPlugins } from "./user-plugins.ts"

const failed = (id: string, reason: string) =>
  reportPluginFailure(id, reason).pipe(Effect.as<UserPlugin>({ _tag: "failed", id, reason }))

export const listPlugins = Stream.unwrap(
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return Stream.empty
    const folders = yield* plugins.folders
    const folderOfId = new Map<string, string>()
    const loads = folders.map((folder): Effect.Effect<UserPlugin> => {
      const reading = readManifest(folder.manifest)
      if (reading.kind === "invalid") return failed(folder.name, reading.reason)
      const { id, name, ui, views } = reading.manifest
      const holder = folderOfId.get(id)
      if (holder !== undefined) {
        return failed(id, `The folder ${holder} already holds a plugin with the id ${id}.`)
      }
      folderOfId.set(id, folder.name)
      return plugins.compile({ id, path: folder.path, entry: ui }).pipe(
        Effect.map((bundle): UserPlugin => ({ _tag: "compiled", id, name, bundle, views })),
        Effect.catchTag("PluginNotCompiled", ({ reason }) => failed(id, reason)),
      )
    })
    return Stream.fromIterable(loads).pipe(
      Stream.mapEffect((load) => load, { concurrency: "unbounded", unordered: true }),
    )
  }),
)
