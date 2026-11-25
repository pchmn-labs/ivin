import type { ViewDeclaration } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { builtinPackages } from "../rules/builtin-packages.ts"
import { readManifest } from "../rules/manifest.ts"
import { UserPlugins } from "./user-plugins.ts"

// Each declared view by its "<plugin id>/<view name>"; a user plugin replaces the built-in one with its id.
export const listViews = Effect.gen(function* () {
  const byPlugin = new Map<string, ReadonlyArray<ViewDeclaration>>()
  const add = (text: string | null) => {
    const reading = readManifest(text)
    if (reading.kind === "valid") {
      byPlugin.set(reading.manifest.id, reading.manifest.views)
    }
  }
  builtinPackages.forEach(add)
  const plugins = yield* UserPlugins
  if (plugins !== null) (yield* plugins.folders).forEach((folder) => add(folder.manifest))
  return [...byPlugin].flatMap(([id, views]) =>
    views.map((view) => ({ ...view, view: `${id}/${view.name}` })),
  )
})
