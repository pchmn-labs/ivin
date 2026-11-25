import { Atom } from "effect/reactivity"
import { contributionsAtom } from "../../plugin/atoms/contributions.ts"
import { settingsPageSections } from "../rules/settings-page-sections.ts"
import { pluginSettingsAtom } from "./settings.ts"

export const settingsPageOpenAtom = Atom.make(false).pipe(Atom.keepAlive)
export const settingsSectionAtom = Atom.make("tabs").pipe(Atom.keepAlive)

export const settingsPageSectionsAtom = Atom.readable((get) =>
  settingsPageSections(
    get(pluginSettingsAtom),
    get(contributionsAtom)
      .filter(({ slot }) => slot === "settings.section")
      .map(({ pluginId }) => pluginId),
  ),
)
