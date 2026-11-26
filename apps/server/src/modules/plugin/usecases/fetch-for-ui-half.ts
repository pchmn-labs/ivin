import { PluginFetchFailed, type PluginFetchRequest } from "@ivin/contracts/plugin-fetch"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { NO_PERMISSIONS } from "../rules/permissions.ts"
import { BuiltinPlugins } from "./builtin-plugins.ts"
import { fetchForPlugin } from "./fetch-for-plugin.ts"
import { pluginFolders } from "./project-plugins.ts"

// The manifest of the version that runs: a folder's replaces the built-in plugin with its id.
const permissionsOf = (id: string) =>
  Effect.gen(function* () {
    const builtins = yield* BuiltinPlugins
    const manifests = [
      ...(yield* pluginFolders).map((folder) => folder.manifest),
      ...(builtins?.plugins ?? []).map((plugin) => plugin.manifest),
    ]
    for (const manifest of manifests) {
      const reading = readManifest(manifest)
      if (reading.kind === "valid" && reading.manifest.id === id) {
        return reading.manifest.permissions
      }
    }
    return NO_PERMISSIONS
  })

export const fetchForUiHalf = (id: string, request: PluginFetchRequest) =>
  permissionsOf(id).pipe(
    Effect.flatMap((permissions) => fetchForPlugin(id, permissions, request)),
    Effect.catchTag("PluginCallFailed", ({ reason }) =>
      Effect.fail(new PluginFetchFailed({ reason })),
    ),
  )
