import type { FileIconRow } from "@ivin/plugin-api/ui"

type Associations = Readonly<Record<string, string>>

interface Entries {
  readonly fileNames?: Associations
  readonly fileExtensions?: Associations
  readonly languageIds?: Associations
  readonly folderNames?: Associations
  readonly folderNamesExpanded?: Associations
  readonly file?: string
  readonly folder?: string
  readonly folderExpanded?: string
}

export interface IconTheme extends Entries {
  readonly iconDefinitions: Readonly<Record<string, { readonly iconPath?: string }>>
  readonly light?: Entries
}

interface Lookup {
  readonly fileNames: ReadonlyMap<string, string>
  readonly fileExtensions: ReadonlyMap<string, string>
  readonly languageIds: ReadonlyMap<string, string>
  readonly folderNames: ReadonlyMap<string, string>
  readonly folderNamesExpanded: ReadonlyMap<string, string>
  readonly file: string | undefined
  readonly folder: string | undefined
  readonly folderExpanded: string | undefined
}

export interface ThemeIndex {
  readonly base: Lookup
  readonly light: Lookup | null
  // Icon id → the SVG's path in the plugin's folder.
  readonly paths: ReadonlyMap<string, string>
  readonly languages: ReadonlyMap<string, string>
}

const lowerCased = (associations: Associations = {}) =>
  new Map(Object.entries(associations).map(([key, id]) => [key.toLowerCase(), id]))

const lookupOf = (entries: Entries): Lookup => ({
  fileNames: lowerCased(entries.fileNames),
  fileExtensions: lowerCased(entries.fileExtensions),
  languageIds: new Map(Object.entries(entries.languageIds ?? {})),
  folderNames: lowerCased(entries.folderNames),
  folderNamesExpanded: lowerCased(entries.folderNamesExpanded),
  file: entries.file,
  folder: entries.folder,
  folderExpanded: entries.folderExpanded,
})

// The theme's icon paths are relative to the theme file, kept in `theme/` of the plugin's folder.
const pathInPlugin = (iconPath: string) =>
  decodeURIComponent(new URL(iconPath, "file:///theme/theme.json").pathname.slice(1))

export const indexTheme = (theme: IconTheme, languages: Associations): ThemeIndex => ({
  base: lookupOf(theme),
  light: theme.light === undefined ? null : lookupOf(theme.light),
  paths: new Map(
    Object.entries(theme.iconDefinitions).flatMap(([id, { iconPath }]) =>
      iconPath === undefined ? [] : [[id, pathInPlugin(iconPath)] as const],
    ),
  ),
  languages: new Map(Object.entries(languages)),
})

// "app.test.ts" → ["test.ts", "ts"]; ".eslintrc.json" → ["eslintrc.json", "json"].
const extensionsOf = (name: string) => {
  const segments = name.split(".")
  return segments.slice(1).map((_, i) => segments.slice(i + 1).join("."))
}

export const iconPathOf = (index: ThemeIndex, row: FileIconRow, light: boolean): string | null => {
  const lookups = light && index.light !== null ? [index.light, index.base] : [index.base]
  const first = (pick: (lookup: Lookup) => string | undefined) => {
    for (const lookup of lookups) {
      const id = pick(lookup)
      if (id !== undefined) return id
    }
    return undefined
  }
  const name = row.name.toLowerCase()
  const id = row.folder
    ? row.open
      ? (first((l) => l.folderNamesExpanded.get(name)) ?? first((l) => l.folderExpanded))
      : (first((l) => l.folderNames.get(name)) ?? first((l) => l.folder))
    : fileIconId(name, first, index.languages)
  return id === undefined ? null : (index.paths.get(id) ?? null)
}

const fileIconId = (
  name: string,
  first: (pick: (lookup: Lookup) => string | undefined) => string | undefined,
  languages: ReadonlyMap<string, string>,
) => {
  const byName = first((l) => l.fileNames.get(name))
  if (byName !== undefined) return byName
  const extensions = extensionsOf(name)
  for (const extension of extensions) {
    const id = first((l) => l.fileExtensions.get(extension))
    if (id !== undefined) return id
  }
  for (const extension of extensions) {
    const language = languages.get(extension)
    const id = language === undefined ? undefined : first((l) => l.languageIds.get(language))
    if (id !== undefined) return id
  }
  return first((l) => l.file)
}
