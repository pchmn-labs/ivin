import type {
  PluginSetting,
  PluginSettingDeclaration,
  SettingValueInvalid,
} from "@ivin/contracts/setting"
import { parseJsonc } from "@ivin/contracts/jsonc"

type FileObject = Record<string, unknown>

const isObject = (value: unknown): value is FileObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

// The last valid object while the text does not parse as one.
export const fileObjectOf = (text: string | null, previous: FileObject): FileObject => {
  if (text === null || text.trim() === "") return {}
  const parsed = parseJsonc(text)
  return parsed.ok && isObject(parsed.value) ? parsed.value : previous
}

const accepts = (declaration: PluginSettingDeclaration, value: unknown) =>
  typeof value === declaration.type &&
  (declaration.type !== "number" || Number.isFinite(value)) &&
  (declaration.values === undefined || declaration.values.includes(value as string))

export const resolvePluginSettings = (
  file: FileObject,
  declarations: ReadonlyArray<PluginSettingDeclaration>,
): ReadonlyArray<PluginSetting> =>
  declarations.map((declaration) => {
    const value = declaration.key
      .split(".")
      .reduce<unknown>(
        (section, key) => (isObject(section) ? section[key] : undefined),
        file[declaration.pluginId],
      )
    if (value === undefined) return { ...declaration, value: declaration.default, ignored: false }
    return accepts(declaration, value)
      ? { ...declaration, value: value as PluginSetting["value"], ignored: false }
      : { ...declaration, value: declaration.default, ignored: true }
  })

// Nested like the file, so `files.file.placement` is found under the app's own `files` section.
export const pluginSettingValues = (settings: ReadonlyArray<PluginSetting>) => {
  const values: Record<string, Record<string, unknown>> = {}
  for (const { pluginId, key, value } of settings) {
    const path = key.split(".")
    let section: Record<string, unknown> = (values[pluginId] ??= {})
    for (const part of path.slice(0, -1)) {
      section = (section[part] ??= {}) as Record<string, unknown>
    }
    section[path[path.length - 1]!] = value
  }
  return values
}

export const pluginSettingPaths = (declarations: ReadonlyArray<PluginSettingDeclaration>) =>
  declarations.map(({ pluginId, key }) => `${pluginId}.${key}`)

// Null when no declaration has that path.
export const checkPluginSetting = (
  declarations: ReadonlyArray<PluginSettingDeclaration>,
  path: string,
  value: unknown,
):
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: "invalidValue"
      readonly expected: SettingValueInvalid["expected"]
      readonly allowed?: ReadonlyArray<string>
    }
  | null => {
  const declaration = declarations.find((d) => `${d.pluginId}.${d.key}` === path)
  if (declaration === undefined) return null
  if (accepts(declaration, value)) return { ok: true }
  return declaration.values !== undefined
    ? { ok: false, reason: "invalidValue", expected: "oneOf", allowed: declaration.values }
    : { ok: false, reason: "invalidValue", expected: declaration.type }
}
