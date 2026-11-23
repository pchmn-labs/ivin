import { defaultSettings } from "@ivin/contracts/setting"
import { expect, test } from "vitest"
import { readSettingsFile } from "./read-settings-file.ts"

const initial = { settings: defaultSettings, problem: null }

test("a missing or empty file holds the default settings: every switch on, the rail layout", () => {
  expect(readSettingsFile(initial, null)).toEqual(initial)
  expect(readSettingsFile(initial, " \n")).toEqual(initial)
  expect(defaultSettings).toEqual({
    tabs: { stopAgentOnClose: true },
    worktrees: { removeOnTabClose: true },
    files: { folderIcons: true },
    sidebar: { layout: "rail" },
  })
})

test("a setting in the file replaces its default, and one left out falls back to it", () => {
  const off = {
    settings: {
      tabs: { stopAgentOnClose: false },
      worktrees: { removeOnTabClose: false },
      files: { folderIcons: false },
      sidebar: { layout: "strip" as const },
    },
    problem: null,
  }
  const text = `{
    // keep agents running
    "tabs": { "stopAgentOnClose": false, },
    "files": { "folderIcons": false },
    "sidebar": { "layout": "strip" },
    "editor": { "fontSize": 13 },
  }`
  expect(readSettingsFile(off, text)).toEqual({
    settings: {
      tabs: { stopAgentOnClose: false },
      worktrees: { removeOnTabClose: true },
      files: { folderIcons: false },
      sidebar: { layout: "strip" },
    },
    problem: null,
  })
})

test("an invalid file keeps the previous settings and names its problem", () => {
  const previous = {
    settings: { ...defaultSettings, tabs: { stopAgentOnClose: false } },
    problem: null,
  }
  expect(readSettingsFile(previous, "{")).toEqual({
    settings: previous.settings,
    problem: { reason: "notJson", setting: null },
  })
  expect(readSettingsFile(previous, "[]").problem).toEqual({ reason: "notAnObject", setting: null })
  expect(readSettingsFile(previous, `{ "tabs": 1 }`)).toEqual({
    settings: previous.settings,
    problem: { reason: "invalidSetting", setting: "tabs" },
  })
  expect(
    readSettingsFile(previous, `{ "worktrees": { "removeOnTabClose": "no" } }`).problem,
  ).toEqual({ reason: "invalidSetting", setting: "worktrees.removeOnTabClose" })
  expect(readSettingsFile(previous, `{ "files": { "folderIcons": 1 } }`).problem).toEqual({
    reason: "invalidSetting",
    setting: "files.folderIcons",
  })
  expect(readSettingsFile(previous, `{ "sidebar": { "layout": "column" } }`).problem).toEqual({
    reason: "invalidSetting",
    setting: "sidebar.layout",
  })
})
