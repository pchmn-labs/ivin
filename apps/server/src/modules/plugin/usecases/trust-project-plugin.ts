import { PluginContentChanged, PluginNotFound } from "@ivin/contracts/plugin"
import { Effect } from "effect"
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
    if (folder === undefined) return yield* new PluginNotFound({ id })
    // Trust follows what was copied and hashed, never a second read of the live folder.
    const kept = yield* plugins.keepTrusted(hash, folder.path)
    if (kept === null) return yield* new PluginContentChanged({ id })
    const copy = yield* plugins.readTree(kept)
    const reading = readManifest(copy?.files.get("package.json")?.text ?? null)
    if (reading.kind === "invalid" || reading.manifest.id !== id) {
      return yield* new PluginContentChanged({ id })
    }
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
