import type { PluginSettingDeclaration } from "@ivin/contracts/setting"

export type ManifestSettingsReading =
  | { readonly kind: "valid"; readonly settings: ReadonlyArray<PluginSettingDeclaration> }
  | { readonly kind: "invalid"; readonly reason: string }

const KEY = /^[A-Za-z][A-Za-z0-9_-]*$/
const TYPES = ["boolean", "number", "string"] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const invalid = (reason: string): ManifestSettingsReading => ({ kind: "invalid", reason })

export const readManifestSettings = (
  pluginId: string,
  pluginName: string,
  declared: unknown,
): ManifestSettingsReading => {
  if (declared === undefined) return { kind: "valid", settings: [] }
  if (!isRecord(declared)) return invalid("ivin.settings in package.json must be an object.")
  const settings: PluginSettingDeclaration[] = []
  for (const [key, setting] of Object.entries(declared)) {
    const at = `ivin.settings.${key}`
    if (!KEY.test(key)) {
      return invalid(`${at} is not a valid key: use letters, digits, dashes and underscores.`)
    }
    if (!isRecord(setting)) return invalid(`${at} in package.json must be an object.`)
    const { type, default: value, title, description, values } = setting
    if (!TYPES.includes(type as (typeof TYPES)[number])) {
      return invalid(`${at}.type must be "boolean", "number" or "string".`)
    }
    if (typeof value !== type) return invalid(`${at}.default must be a ${String(type)}.`)
    if (typeof title !== "string" || title === "") {
      return invalid(`${at}.title must be a non-empty string.`)
    }
    if (typeof description !== "string" || description === "") {
      return invalid(`${at}.description must be a non-empty string.`)
    }
    let allowed: ReadonlyArray<string> | undefined
    if (values !== undefined) {
      if (type !== "string") return invalid(`${at}.values is only for a string setting.`)
      if (
        !Array.isArray(values) ||
        values.length === 0 ||
        !values.every((item) => typeof item === "string")
      ) {
        return invalid(`${at}.values must be a non-empty list of strings.`)
      }
      allowed = values
      if (!allowed.includes(value as string)) {
        return invalid(`${at}.default must be one of ${allowed.join(", ")}.`)
      }
    }
    settings.push({
      pluginId,
      pluginName,
      key,
      type: type as (typeof TYPES)[number],
      default: value as boolean | number | string,
      title,
      description,
      ...(allowed !== undefined && { values: allowed }),
    })
  }
  return { kind: "valid", settings }
}
