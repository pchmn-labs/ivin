import { defaultSettings, type Settings } from "@ivin/contracts/setting"
import { Context } from "effect"

export const SettingDefaults = Context.Reference<Settings>("ivin/server/SettingDefaults", {
  defaultValue: () => defaultSettings,
})
