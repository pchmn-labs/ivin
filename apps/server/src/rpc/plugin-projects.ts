import { Effect, Layer } from "effect"
import { realpath } from "node:fs/promises"
import { PluginProjects } from "../modules/plugin/usecases/plugin-projects.ts"
import { ProjectStore } from "../modules/project/usecases/project-store.ts"

export const layerPluginProjects = Layer.effect(PluginProjects)(
  Effect.gen(function* () {
    const store = yield* ProjectStore
    return {
      trusted: store.trustedProjects,
      openAs: Effect.gen(function* () {
        const trusted = new Set(yield* store.trustedProjects)
        const byTrusted = new Map<string, string[]>()
        for (const { path } of (yield* store.listOpen).projects) {
          const real = yield* Effect.promise(() => realpath(path).catch(() => path))
          if (!trusted.has(real) || real === path) continue
          byTrusted.set(real, [...(byTrusted.get(real) ?? []), path])
        }
        return byTrusted
      }),
    }
  }),
)
