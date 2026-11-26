import type { ProjectPlugin, ProjectPluginChange, ProjectPlugins } from "@ivin/contracts/plugin"
import { DateTime, Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { changedFiles, unifiedDiff, type PluginTree } from "../rules/plugin-diff.ts"
import {
  decideTrust,
  permissionList,
  projectNameOf,
  projectPluginKey,
  projectPluginsRoot,
} from "../rules/project-plugin-trust.ts"
import { ProjectPluginLock } from "./project-plugin-lock.ts"
import { PluginProjects } from "./plugin-projects.ts"
import { PluginSwitches } from "./plugin-switches.ts"
import { ProjectPluginTrustStore } from "./project-plugin-trust-store.ts"
import { ProjectPluginUpdates } from "./project-plugin-updates.ts"
import { UserPlugins, type PluginFolder, type UserPluginsService } from "./user-plugins.ts"

export interface ResolvedProjectPlugin {
  readonly key: string
  readonly plugin: ProjectPlugin
  // The hash-named copy whose files run, whatever the state; none when new.
  readonly run: PluginFolder | null
}

export interface ResolvedProject {
  readonly project: string
  readonly fullTrust: boolean
  readonly plugins: ReadonlyArray<ResolvedProjectPlugin>
  // Folders whose manifest cannot be read: nothing runs, the load reports why.
  readonly unreadable: ReadonlyArray<PluginFolder>
  readonly changes: ReadonlyArray<ProjectPluginChange>
}

const trustedVersionOf = (plugins: UserPluginsService, hash: string) =>
  Effect.gen(function* () {
    const path = yield* plugins.trustedFolder(hash)
    const tree = path === null ? null : yield* plugins.readTree(path)
    return path === null || tree === null ? null : { path, files: tree.files }
  })

const manifestOf = (files: PluginTree) => files.get("package.json")?.text ?? null

const resolveProject = (project: string, seenOnAdopt: boolean) =>
  Effect.gen(function* () {
    const plugins = (yield* UserPlugins)!
    const store = (yield* ProjectPluginTrustStore)!
    const updates = yield* ProjectPluginUpdates
    const fullTrust = yield* store.fullTrust(project)
    const resolved: ResolvedProjectPlugin[] = []
    const unreadable: PluginFolder[] = []
    let adopted = false
    for (const folder of yield* plugins.foldersIn(projectPluginsRoot(project))) {
      const key = projectPluginKey(project, folder.name)
      const reading = readManifest(folder.manifest)
      if (reading.kind === "invalid") {
        unreadable.push({ ...folder, name: key, label: folder.name })
        continue
      }
      const { id, name, permissions } = reading.manifest
      const tree = yield* plugins.readTree(folder.path)
      if (tree === null) continue
      const declared = permissionList(permissions)
      let trusted = yield* store.trusted(project, id)
      const previous =
        trusted === null || trusted.hash === tree.hash
          ? null
          : yield* trustedVersionOf(plugins, trusted.hash)
      // A trusted version whose copy is gone cannot keep running: the plugin is asked about again.
      if (trusted !== null && trusted.hash !== tree.hash && previous === null) trusted = null
      const decision = decideTrust({ trusted, hash: tree.hash, permissions: declared, fullTrust })
      const diffBase = previous?.files ?? null
      const settled = decision.state === "trusted"
      // What runs is always the copy that hashes to what the user trusted, never the live folder.
      const copy = settled
        ? ((yield* plugins.trustedFolder(tree.hash)) ??
          (yield* plugins.keepTrusted(tree.hash, folder.path)))
        : null
      // The files changed between the read and the copy: the next change on disk resolves again.
      if (settled && copy === null) continue
      if (decision.adopt) {
        yield* store.trust(project, id, { hash: tree.hash, permissions: declared })
        yield* store.addChange(project, {
          id,
          name,
          hash: tree.hash,
          at: DateTime.toEpochMillis(yield* DateTime.now),
          isNew: trusted === null,
          files: changedFiles(diffBase, tree.files),
          diff: unifiedDiff(diffBase, tree.files),
          seen: seenOnAdopt,
        })
        adopted = true
      }
      const runPath = copy ?? previous?.path ?? null
      const run: PluginFolder | null =
        runPath === null
          ? null
          : {
              name: key,
              label: folder.name,
              path: runPath,
              manifest: settled ? manifestOf(tree.files) : manifestOf(previous!.files),
            }
      resolved.push({
        key,
        run,
        plugin: {
          id,
          name,
          state: decision.state,
          hash: tree.hash,
          files: settled ? [] : changedFiles(diffBase, tree.files),
          diff: settled ? "" : unifiedDiff(diffBase, tree.files),
          permissionsChanged: decision.permissionsChanged,
          permissions: declared,
        },
      })
    }
    if (adopted) yield* updates.publish
    return {
      project,
      fullTrust,
      plugins: resolved,
      unreadable,
      changes: yield* store.changes(project),
    } satisfies ResolvedProject
  })

const resolveTrusted = (seenOnAdopt: boolean, only?: string) =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    const projects = yield* PluginProjects
    const store = yield* ProjectPluginTrustStore
    const switches = yield* PluginSwitches
    if (plugins === null || projects === null || store === null || switches?.safe === true) {
      return [] as ReadonlyArray<ResolvedProject>
    }
    const trusted = (yield* projects.trusted).filter(
      (project) => only === undefined || project === only,
    )
    return yield* Effect.forEach(trusted, (project) => resolveProject(project, seenOnAdopt))
  })

// The trusted projects' plugins as they stand now; full trust adopts what it covers on the way.
export const resolveProjectPlugins = Effect.gen(function* () {
  return yield* (yield* ProjectPluginLock).exclusive(resolveTrusted(false))
})

// Sets the flag and adopts what waits in one locked step, so a concurrent listing never adopts it as unseen.
export const turnProjectFullTrustOn = (project: string) =>
  Effect.gen(function* () {
    const store = yield* ProjectPluginTrustStore
    yield* (yield* ProjectPluginLock).exclusive(
      Effect.gen(function* () {
        yield* store!.setFullTrust(project, true)
        // What waited was already shown to the user: its change is recorded as seen.
        yield* resolveTrusted(true, project)
      }),
    )
  })

// What a window shows: projects with no plugin and no change are left out.
export const toProjectPlugins = (
  resolved: ReadonlyArray<ResolvedProject>,
  openAs: ReadonlyMap<string, ReadonlyArray<string>> = new Map(),
): ProjectPlugins[] =>
  resolved
    .filter(
      ({ plugins, unreadable, changes }) => plugins.length + unreadable.length + changes.length > 0,
    )
    .map(({ project, fullTrust, plugins, changes }) => ({
      project,
      projectName: projectNameOf(project),
      openAs: openAs.get(project) ?? [],
      fullTrust,
      plugins: plugins.map(({ plugin }) => plugin),
      changes,
    }))

// Every folder that loads, in load order: user plugins first, then each trusted project's; a later one with the same id replaces an earlier one.
export const pluginFolders = Effect.gen(function* () {
  const plugins = yield* UserPlugins
  const switches = yield* PluginSwitches
  if (plugins === null || switches?.safe === true) return []
  const user = yield* plugins.folders
  const project = (yield* resolveProjectPlugins).flatMap(({ plugins: found, unreadable }) => [
    ...unreadable,
    ...found.flatMap(({ run }) => (run === null ? [] : [run])),
  ])
  const idOf = (folder: PluginFolder) => {
    const reading = readManifest(folder.manifest)
    return reading.kind === "valid" ? reading.manifest.id : null
  }
  const projectFolderOfId = new Map<string, PluginFolder>()
  for (const folder of project) {
    const id = idOf(folder)
    if (id !== null) projectFolderOfId.set(id, folder)
  }
  return [
    ...user.filter((folder) => !projectFolderOfId.has(idOf(folder) ?? "")),
    ...project.filter((folder) => {
      const id = idOf(folder)
      return id === null || projectFolderOfId.get(id) === folder
    }),
  ]
})
