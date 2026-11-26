import type { PluginPermissions } from "@ivin/contracts/plugin"

export type Permissions = PluginPermissions

export type PermissionsReading =
  | { readonly kind: "valid"; readonly permissions: Permissions }
  | { readonly kind: "invalid"; readonly reason: string }

export type PluginCall =
  | { readonly member: "harness.beforeSpawn" }
  | { readonly member: "exec"; readonly binary: string }
  | { readonly member: "fetch"; readonly url: string }

export type Verdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly missing: string }

export const NO_PERMISSIONS: Permissions = { harness: [], exec: [], fetch: [] }

const HARNESS_HOOKS = ["beforeSpawn"]
const HOST = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const invalid = (reason: string): PermissionsReading => ({ kind: "invalid", reason })

const readList = (
  key: keyof Permissions,
  value: unknown,
  accepts: (entry: string) => string | null,
): readonly string[] | string => {
  if (value === undefined) return []
  if (!Array.isArray(value)) return `ivin.permissions.${key} must be an array of strings.`
  for (const entry of value) {
    if (typeof entry !== "string" || entry === "") {
      return `ivin.permissions.${key} must hold only non-empty strings.`
    }
    const problem = accepts(entry)
    if (problem !== null) return `ivin.permissions.${key}: ${problem}`
  }
  return value as readonly string[]
}

const acceptsHook = (entry: string) =>
  HARNESS_HOOKS.includes(entry) ? null : `"${entry}" is not a hook (${HARNESS_HOOKS.join(", ")}).`

const acceptsBinary = (entry: string) =>
  entry === "*" || !/[\s*]/.test(entry) ? null : `"${entry}" is not a program name or "*".`

const acceptsHost = (entry: string) =>
  entry === "*" || HOST.test(entry)
    ? null
    : `"${entry}" is not a host name, "*.host" or "*" (no scheme, port or path).`

export const readPermissions = (value: unknown): PermissionsReading => {
  if (value === undefined) return { kind: "valid", permissions: NO_PERMISSIONS }
  if (!isRecord(value)) return invalid("ivin.permissions in package.json must be an object.")
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(NO_PERMISSIONS, key)) {
      return invalid(`ivin.permissions.${key} is not a permission (harness, exec, fetch).`)
    }
  }
  const harness = readList("harness", value["harness"], acceptsHook)
  const exec = readList("exec", value["exec"], acceptsBinary)
  const fetch = readList("fetch", value["fetch"], acceptsHost)
  for (const list of [harness, exec, fetch]) {
    if (typeof list === "string") return invalid(list)
  }
  return {
    kind: "valid",
    permissions: { harness, exec, fetch } as Permissions,
  }
}

const allowedHost = (declared: readonly string[], host: string): boolean =>
  declared.some(
    (entry) =>
      entry === "*" ||
      entry.toLowerCase() === host ||
      (entry.startsWith("*.") && host.endsWith(entry.slice(1).toLowerCase())),
  )

const checks: {
  readonly [M in PluginCall["member"]]: (
    permissions: Permissions,
    call: Extract<PluginCall, { member: M }>,
  ) => Verdict
} = {
  "harness.beforeSpawn": (permissions) =>
    permissions.harness.includes("beforeSpawn")
      ? { allowed: true }
      : { allowed: false, missing: "harness: beforeSpawn" },
  exec: (permissions, { binary }) =>
    permissions.exec.includes("*") || permissions.exec.includes(binary)
      ? { allowed: true }
      : { allowed: false, missing: `exec: ${binary}` },
  fetch: (permissions, { url }) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return { allowed: false, missing: "fetch: a URL ivin cannot read" }
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { allowed: false, missing: `fetch: ${parsed.protocol}` }
    }
    return allowedHost(permissions.fetch, parsed.hostname)
      ? { allowed: true }
      : { allowed: false, missing: `fetch: ${parsed.hostname}` }
  },
}

export const permits = (permissions: Permissions, call: PluginCall): Verdict =>
  (checks[call.member] as (permissions: Permissions, call: PluginCall) => Verdict)(
    permissions,
    call,
  )
