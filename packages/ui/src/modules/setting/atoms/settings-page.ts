import { AsyncResult, Atom } from "effect/reactivity"
import { listBuiltinPluginsAtom } from "../../plugin/atoms/list-builtin-plugins.ts"
import { listPluginsAtom } from "../../plugin/atoms/list-plugins.ts"
import { contributionsAtom } from "../../plugin/atoms/contributions.ts"
import { settingsPageSections } from "../rules/settings-page-sections.ts"
import { pluginSettingsAtom } from "./settings.ts"

export const settingsPageOpenAtom = Atom.make(false).pipe(Atom.keepAlive)
export const settingsSectionAtom = Atom.make("tabs").pipe(Atom.keepAlive)

export const settingsPageSectionsAtom = Atom.readable((get) => {
  const names = new Map<string, string>()
  for (const result of [get(listBuiltinPluginsAtom), get(listPluginsAtom)]) {
    if (!AsyncResult.isSuccess(result)) continue
    for (const plugin of result.value)
      if (plugin._tag === "compiled") names.set(plugin.id, plugin.name)
  }
  return settingsPageSections(
    get(pluginSettingsAtom),
    get(contributionsAtom)
      .filter(({ slot }) => slot === "settings.section")
      .map(({ pluginId }) => pluginId),
    names,
  )
})
