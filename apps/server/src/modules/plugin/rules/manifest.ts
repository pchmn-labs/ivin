import { readPermissions } from "./permissions.ts"
import type { Permissions } from "./permissions.ts"

export interface UiManifest {
  readonly id: string
  readonly name: string
  // The UI half's entry, relative to the plugin's folder.
  readonly ui: string
  readonly permissions: Permissions
}

export type ManifestReading =
  | { readonly kind: "valid"; readonly manifest: UiManifest }
  | { readonly kind: "invalid"; readonly reason: string }

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

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
  const { id, name, ui, permissions } = ivin
  if (typeof id !== "string" || !ID.test(id)) {
    return invalid("ivin.id in package.json must be lowercase letters, digits and dashes.")
  }
  if (name !== undefined && typeof name !== "string") {
    return invalid("ivin.name in package.json must be a string.")
  }
  if (typeof ui !== "string" || ui === "") {
    return invalid(
      "ivin.ui in package.json names no file: ivin loads only a plugin's UI half for now.",
    )
  }
  const reading = readPermissions(permissions)
  if (reading.kind === "invalid") return invalid(reading.reason)
  return {
    kind: "valid",
    manifest: { id, name: name ?? id, ui, permissions: reading.permissions },
  }
}
