import { Duration, Effect, Stream } from "effect"
import { projectPluginKey, projectPluginsRoot } from "../rules/project-plugin-trust.ts"
import { ProjectPluginUpdates } from "./project-plugin-updates.ts"
import { PluginProjects } from "./plugin-projects.ts"
import { PluginSwitches } from "./plugin-switches.ts"
import { requestReload } from "./request-reload.ts"
import { UserPlugins } from "./user-plugins.ts"

// A project trusted while ivin runs is picked up within this time.
const PROJECTS_LOOKED_UP_EVERY = Duration.seconds(3)

// Reloads a plugin each time its folder changes, until the scope closes.
export const watchPluginFolders = Effect.gen(function* () {
  const plugins = yield* UserPlugins
  if (plugins === null) return
  const projects = yield* PluginProjects
  const switches = yield* PluginSwitches
  const updates = yield* ProjectPluginUpdates
  const watched = new Set<string>()
  const watchProjects = Effect.gen(function* () {
    if (projects === null || switches?.safe === true) return
    let started = true
    while (true) {
      for (const project of yield* projects.trusted) {
        if (watched.has(project)) continue
        watched.add(project)
        // The window listed the plugins before this project was trusted.
        if (!started) {
          for (const folder of yield* plugins.foldersIn(projectPluginsRoot(project))) {
            yield* requestReload(projectPluginKey(project, folder.name))
          }
          yield* updates.publish
        }
        yield* Effect.forkScoped(
          plugins.projectChanges(project).pipe(
            Stream.map((folderName) => projectPluginKey(project, folderName)),
            Stream.mapEffect(requestReload, { concurrency: "unbounded" }),
            Stream.runDrain,
          ),
        )
      }
      started = false
      yield* Effect.sleep(PROJECTS_LOOKED_UP_EVERY)
    }
  })
  yield* Effect.all(
    [
      plugins.changes.pipe(
        Stream.mapEffect(requestReload, { concurrency: "unbounded" }),
        Stream.runDrain,
      ),
      watchProjects,
    ],
    { concurrency: "unbounded", discard: true },
  )
}).pipe(Effect.scoped)
