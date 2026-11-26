import type { PluginSetting } from "@ivin/contracts/setting"
import { expect, test } from "vitest"
import { settingChanges } from "./plugin-setting-changes.ts"

const setting = (pluginId: string, key: string, value: boolean | number | string) =>
  ({ pluginId, key, value }) as PluginSetting

test("reports the settings whose value differs", () => {
  const before = [setting("p", "a", 1), setting("p", "b", "x")]
  const after = [setting("p", "a", 2), setting("p", "b", "x"), setting("q", "c", true)]
  expect(settingChanges(before, after)).toEqual([
    { pluginId: "p", key: "a", value: 2 },
    { pluginId: "q", key: "c", value: true },
  ])
})
