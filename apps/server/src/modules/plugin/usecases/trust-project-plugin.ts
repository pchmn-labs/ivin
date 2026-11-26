import { PluginContentChanged, PluginNotFound } from "@ivin/contracts/plugin"
import { Effect, Stream } from "effect"
import { readManifest } from "../rules/manifest.ts"
import {
  permissionList,
  projectPluginKey,
  projectPluginsRoot,
} from "../rules/project-plugin-trust.ts"
import { PluginHost } from "./plugin-host.ts"
import { PluginProjects } from "./plugin-projects.ts"
import { ProjectPluginTrustStore } from "./project-plugin-trust-store.ts"
import { ProjectPluginUpdates } from "./project-plugin-updates.ts"
import { resolveProjectPlugins, toProjectPlugins } from "./project-plugins.ts"
import { reloadFolders } from "./reload-folders.ts"
import { UserPlugins } from "./user-plugins.ts"

// Never trusts a version other than the one the user was shown: `hash` came from `plugin.projectPlugins`.
export const trustProjectPlugin = (project: string, id: string, hash: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    const projects = yield* PluginProjects
    const store = yield* ProjectPluginTrustStore
    if (plugins === null || projects === null || store === null) {
      return yield* new PluginNotFound({ id })
    }
    if (!(yield* projects.trusted).includes(project)) return yield* new PluginNotFound({ id })
    const folder = (yield* plugins.foldersIn(projectPluginsRoot(project))).find((candidate) => {
      const reading = readManifest(candidate.manifest)
      return reading.kind === "valid" && reading.manifest.id === id
    })
    const reading = readManifest(folder?.manifest ?? null)
    if (folder === undefined || reading.kind === "invalid") return yield* new PluginNotFound({ id })
    const tree = yield* plugins.readTree(folder.path)
    if (tree === null) return yield* new PluginNotFound({ id })
    if (tree.hash !== hash) return yield* new PluginContentChanged({ id })
    yield* plugins.keepTrusted(hash, folder.path)
    yield* store.trust(project, id, {
      hash,
      permissions: permissionList(reading.manifest.permissions),
    })
    yield* (yield* ProjectPluginUpdates).publish
    const host = yield* PluginHost
    yield* reloadFolders(
      [projectPluginKey(project, folder.name)],
      host !== null && reading.manifest.server !== null,
    )
  })

const everyFolderKey = (project: string) =>
  Effect.gen(function* () {
    const plugins = (yield* UserPlugins)!
    return (yield* plugins.foldersIn(projectPluginsRoot(project))).map((folder) =>
      projectPluginKey(project, folder.name),
    )
  })

// Full trust ON runs at once what the project holds pending, permissions apart; OFF leaves what runs as it is.
export const setProjectFullTrust = (project: string, enabled: boolean) =>
  Effect.gen(function* () {
    const store = yield* ProjectPluginTrustStore
    const projects = yield* PluginProjects
    const plugins = yield* UserPlugins
    if (store === null || projects === null || plugins === null) return
    if (!(yield* projects.trusted).includes(project)) return
    yield* store.setFullTrust(project, enabled)
    if (enabled) {
      // What was pending was already shown to the user: its change is recorded as seen.
      yield* resolveProjectPlugins(true)
      const host = yield* PluginHost
      yield* reloadFolders(yield* everyFolderKey(project), host !== null)
    }
    yield* (yield* ProjectPluginUpdates).publish
  })

export const markProjectChangesSeen = (project: string) =>
  Effect.gen(function* () {
    const store = yield* ProjectPluginTrustStore
    if (store === null) return
    yield* store.markChangesSeen(project)
    yield* (yield* ProjectPluginUpdates).publish
  })

// The snapshot now, then one more after each trust change, edit, toggle or seen mark.
export const watchProjectPlugins = Stream.unwrap(
  Effect.gen(function* () {
    const updates = yield* (yield* ProjectPluginUpdates).subscribe
    const snapshot = resolveProjectPlugins().pipe(Effect.map(toProjectPlugins))
    return Stream.fromEffect(snapshot).pipe(
      Stream.concat(updates.pipe(Stream.mapEffect(() => snapshot))),
    )
  }),
)
