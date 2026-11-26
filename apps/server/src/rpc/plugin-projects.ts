import { Effect, Layer } from "effect"
import { PluginProjects } from "../modules/plugin/usecases/plugin-projects.ts"
import { ProjectStore } from "../modules/project/usecases/project-store.ts"

export const layerPluginProjects = Layer.effect(PluginProjects)(
  Effect.gen(function* () {
    const store = yield* ProjectStore
    return { trusted: store.trustedProjects }
  }),
)
