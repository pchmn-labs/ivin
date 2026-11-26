import { Effect, Stream } from "effect"
import { PluginProjects } from "./plugin-projects.ts"
import { ProjectPluginUpdates } from "./project-plugin-updates.ts"
import { resolveProjectPlugins, toProjectPlugins } from "./project-plugins.ts"

// The snapshot now, then one more after each trust change, edit, toggle or seen mark.
export const watchProjectPlugins = Stream.unwrap(
  Effect.gen(function* () {
    const updates = yield* (yield* ProjectPluginUpdates).subscribe
    const projects = yield* PluginProjects
    const snapshot = Effect.gen(function* () {
      const openAs =
        projects === null ? new Map<string, ReadonlyArray<string>>() : yield* projects.openAs
      return toProjectPlugins(yield* resolveProjectPlugins, openAs)
    })
    return Stream.fromEffect(snapshot).pipe(
      Stream.concat(updates.pipe(Stream.mapEffect(() => snapshot))),
    )
  }),
)
