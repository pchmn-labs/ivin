import type { SettingSection } from "@ivin/contracts/setting"
import { Atom } from "effect/reactivity"

// The settings page takes the whole window in place of the projects and sessions.
export const settingsPageOpenAtom = Atom.make(false).pipe(Atom.keepAlive)

export const settingsSectionAtom = Atom.make<SettingSection["key"]>("tabs").pipe(Atom.keepAlive)
