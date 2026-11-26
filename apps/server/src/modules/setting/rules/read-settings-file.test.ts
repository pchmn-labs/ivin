import { defaultSettings, defaultSettingsFor, type UserSettings } from "@ivin/contracts/setting"
import { expect, test } from "vitest"
import { readSettingsFile } from "./read-settings-file.ts"

const initial = { settings: defaultSettings, problem: null }
const readWithDefaults = (previous: UserSettings, text: string | null) =>
  readSettingsFile(previous, text, defaultSettings)

test("a missing or empty file holds the default settings: every switch on, the rail layout", () => {
  expect(readWithDefaults(initial, null)).toEqual(initial)
  expect(readWithDefaults(initial, " \n")).toEqual(initial)
})

test("a setting in the file replaces its default, and one left out falls back to it", () => {
  const off = {
    settings: {
      tabs: { stopAgentOnClose: false, newTabPosition: "afterCurrent" as const },
      worktrees: { removeOnTabClose: false },
      files: { folderIcons: false },
      sidebar: { layout: "strip" as const },
      agents: { stopWhenIdleMinutes: 0 },
      updates: { automaticCheck: true, beta: false },
    },
    problem: null,
  }
  const text = `{
    // keep agents running
    "tabs": { "stopAgentOnClose": false, "newTabPosition": "afterCurrent" },
    "files": { "folderIcons": false },
    "sidebar": { "layout": "strip" },
    "agents": { "stopWhenIdleMinutes": 0 },
    "editor": { "fontSize": 13 },
  }`
  expect(readWithDefaults(off, text)).toEqual({
    settings: {
      tabs: { stopAgentOnClose: false, newTabPosition: "afterCurrent" as const },
      worktrees: { removeOnTabClose: true },
      files: { folderIcons: false },
      sidebar: { layout: "strip" },
      agents: { stopWhenIdleMinutes: 0 },
      updates: { automaticCheck: true, beta: false },
    },
    problem: null,
  })
})

test("an invalid file keeps the previous settings and names its problem", () => {
  const previous = {
    settings: { ...defaultSettings, tabs: { ...defaultSettings.tabs, stopAgentOnClose: false } },
    problem: null,
  }
  expect(readWithDefaults(previous, "{")).toEqual({
    settings: previous.settings,
    problem: { reason: "notJson", setting: null },
  })
  expect(readWithDefaults(previous, "[]").problem).toEqual({ reason: "notAnObject", setting: null })
  expect(readWithDefaults(previous, `{ "tabs": 1 }`)).toEqual({
    settings: previous.settings,
    problem: { reason: "invalidSetting", setting: "tabs" },
  })
  expect(
    readWithDefaults(previous, `{ "worktrees": { "removeOnTabClose": "no" } }`).problem,
  ).toEqual({ reason: "invalidSetting", setting: "worktrees.removeOnTabClose" })
  expect(readWithDefaults(previous, `{ "files": { "folderIcons": 1 } }`).problem).toEqual({
    reason: "invalidSetting",
    setting: "files.folderIcons",
  })
  expect(readWithDefaults(previous, `{ "sidebar": { "layout": "column" } }`).problem).toEqual({
    reason: "invalidSetting",
    setting: "sidebar.layout",
  })
  for (const minutes of ["10", -1, 1.5, null]) {
    expect(
      readWithDefaults(
        previous,
        `{ "agents": { "stopWhenIdleMinutes": ${JSON.stringify(minutes)} } }`,
      ).problem,
    ).toEqual({ reason: "invalidSetting", setting: "agents.stopWhenIdleMinutes" })
  }
})

test("a beta install reads betas as on until the file sets them", () => {
  const defaults = defaultSettingsFor("0.1.0-beta.0")
  expect(readSettingsFile(initial, null, defaults).settings.updates.beta).toBe(true)
  expect(readSettingsFile(initial, "{}", defaults).settings.updates.beta).toBe(true)
  expect(
    readSettingsFile(initial, '{ "updates": { "beta": false } }', defaults).settings.updates.beta,
  ).toBe(false)
  expect(readSettingsFile(initial, '{ "updates": { "beta": 1 } }', defaults).problem).toEqual({
    reason: "invalidSetting",
    setting: "updates.beta",
  })
})
