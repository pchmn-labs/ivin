import { Atom } from "effect/reactivity"
import type { SettingsPageSectionKey } from "../rules/settings-page-sections.ts"

export const settingsPageOpenAtom = Atom.make(false).pipe(Atom.keepAlive)

export const settingsSectionAtom = Atom.make<SettingsPageSectionKey>("tabs").pipe(Atom.keepAlive)
