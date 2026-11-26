import type { PluginSettingDeclaration } from "@ivin/contracts/setting"
import type { ViewDeclaration } from "@ivin/contracts/plugin"
import { placementSettings, readManifestViews } from "./manifest-views.ts"
import { readManifestSettings } from "./manifest-settings.ts"
import { readPermissions } from "./permissions.ts"
import type { Permissions } from "./permissions.ts"

export interface UiManifest {
  readonly id: string
  readonly name: string
  // The halves' entries, relative to the plugin's folder; null for a half the plugin lacks.
  readonly ui: string | null
  readonly server: string | null
  readonly permissions: Permissions
  // The declared settings, then one placement setting per view with several placements.
  readonly settings: ReadonlyArray<PluginSettingDeclaration>
  readonly views: ReadonlyArray<ViewDeclaration>
}

export type ManifestReading =
  | { readonly kind: "valid"; readonly manifest: UiManifest }
  | { readonly kind: "invalid"; readonly reason: string }

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const isPluginId = (id: string) => ID.test(id)

const invalid = (reason: string): ManifestReading => ({ kind: "invalid", reason })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const readManifest = (text: string | null): ManifestReading => {
  if (text === null) return invalid("The plugin's folder has no package.json.")
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    return invalid(`package.json is not valid JSON: ${(error as Error).message}`)
  }
  const ivin = isRecord(json) ? json["ivin"] : undefined
  if (!isRecord(ivin)) return invalid("package.json has no ivin key, which holds the manifest.")
  const { id, name, ui, server, permissions, settings, views } = ivin
  if (typeof id !== "string" || !ID.test(id)) {
    return invalid("ivin.id in package.json must be lowercase letters, digits and dashes.")
  }
  if (name !== undefined && typeof name !== "string") {
    return invalid("ivin.name in package.json must be a string.")
  }
  for (const [key, entry] of [
    ["ui", ui],
    ["server", server],
  ] as const) {
    if (entry !== undefined && (typeof entry !== "string" || entry === "")) {
      return invalid(`ivin.${key} in package.json must name a file.`)
    }
  }
  if (ui === undefined && server === undefined) {
    return invalid("package.json names no half: ivin.ui or ivin.server must name a file.")
  }
  const reading = readPermissions(permissions)
  if (reading.kind === "invalid") return invalid(reading.reason)
  const declared = readManifestSettings(id, name ?? id, settings)
  if (declared.kind === "invalid") return invalid(declared.reason)
  const declaredViews = readManifestViews(views)
  if (declaredViews.kind === "invalid") return invalid(declaredViews.reason)
  return {
    kind: "valid",
    manifest: {
      id,
      name: name ?? id,
      ui: (ui as string | undefined) ?? null,
      server: (server as string | undefined) ?? null,
      permissions: reading.permissions,
      settings: [...declared.settings, ...placementSettings(id, name ?? id, declaredViews.views)],
      views: declaredViews.views,
    },
  }
}
