import type { PluginSetting } from "@ivin/contracts/setting"

export interface SettingChange {
  readonly pluginId: string
  readonly key: string
  readonly value: PluginSetting["value"]
}

export const settingChanges = (
  before: ReadonlyArray<PluginSetting>,
  after: ReadonlyArray<PluginSetting>,
): ReadonlyArray<SettingChange> => {
  const previous = new Map(before.map((s) => [`${s.pluginId}\0${s.key}`, s.value]))
  return after
    .filter((s) => previous.get(`${s.pluginId}\0${s.key}`) !== s.value)
    .map(({ pluginId, key, value }) => ({ pluginId, key, value }))
}
