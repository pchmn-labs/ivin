import { Effect } from "effect"
import { projectPluginKey, projectPluginsRoot } from "../rules/project-plugin-trust.ts"
import { PluginHost } from "./plugin-host.ts"
import { PluginProjects } from "./plugin-projects.ts"
import { ProjectPluginTrustStore } from "./project-plugin-trust-store.ts"
import { ProjectPluginUpdates } from "./project-plugin-updates.ts"
import { turnProjectFullTrustOn } from "./project-plugins.ts"
import { reloadFolders } from "./reload-folders.ts"
import { UserPlugins } from "./user-plugins.ts"

// Full trust ON runs at once what the project holds pending, permissions apart; OFF leaves what runs as it is.
export const setProjectFullTrust = (project: string, enabled: boolean) =>
  Effect.gen(function* () {
    const store = yield* ProjectPluginTrustStore
    const projects = yield* PluginProjects
    const plugins = yield* UserPlugins
    if (store === null || projects === null || plugins === null) return
    if (!(yield* projects.trusted).includes(project)) return
    if (enabled) {
      yield* turnProjectFullTrustOn(project)
      const host = yield* PluginHost
      const folders = yield* plugins.foldersIn(projectPluginsRoot(project))
      yield* reloadFolders(
        folders.map((folder) => projectPluginKey(project, folder.name)),
        host !== null,
      )
    } else {
      yield* store.setFullTrust(project, false)
    }
    yield* (yield* ProjectPluginUpdates).publish
  })
