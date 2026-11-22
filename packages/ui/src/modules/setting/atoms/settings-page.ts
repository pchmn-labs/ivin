import type { SettingSection } from "@ivin/contracts/setting"
import { Atom } from "effect/reactivity"

export const settingsPageOpenAtom = Atom.make(false).pipe(Atom.keepAlive)

export const settingsSectionAtom = Atom.make<SettingSection["key"]>("tabs").pipe(Atom.keepAlive)
