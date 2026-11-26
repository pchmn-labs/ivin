import type { PluginSetting } from "@ivin/contracts/setting"
import { expect, test } from "vitest"
import { settingsPageSections } from "./settings-page-sections.ts"

const setting = (key: string, extra: Partial<PluginSetting> = {}): PluginSetting => ({
  pluginId: "prs",
  pluginName: "Session PRs",
  key,
  type: "number",
  default: 2,
  title: `Title of ${key}`,
  description: `About ${key}.`,
  value: 2,
  ignored: false,
  ...extra,
})

test("the app's sections come first, then one per plugin with settings, then the command line", () => {
  const sections = settingsPageSections([setting("a"), setting("b")], [])
  expect(sections.map(({ key }) => key)).toEqual([
    "tabs",
    "worktrees",
    "files",
    "sidebar",
    "agents",
    "images",
    "updates",
    "plugins",
    "plugin:prs",
    "commandLine",
  ])
  const prs = sections.find(({ key }) => key === "plugin:prs")
  expect(prs).toMatchObject({ title: "Session PRs", pluginId: "prs" })
  expect(
    prs?.settings.map(({ path, label, description }) => ({ path, label, description })),
  ).toEqual([
    { path: "prs.a", label: "Title of a", description: "About a." },
    { path: "prs.b", label: "Title of b", description: "About b." },
  ])
})

test("a string setting with allowed values is a choice", () => {
  const [pluginSection] = settingsPageSections(
    [
      setting("layout", {
        type: "string",
        default: "rail",
        value: "rail",
        values: ["rail", "strip"],
      }),
    ],
    [],
  ).filter(({ pluginId }) => pluginId !== undefined)
  expect(pluginSection?.settings[0]?.choices).toEqual([
    { value: "rail", label: "rail" },
    { value: "strip", label: "strip" },
  ])
})

test("a plugin with its own section and no setting still gets a section", () => {
  const sections = settingsPageSections([], ["tools"])
  expect(sections.find(({ key }) => key === "plugin:tools")).toMatchObject({
    title: "tools",
    settings: [],
  })
})
