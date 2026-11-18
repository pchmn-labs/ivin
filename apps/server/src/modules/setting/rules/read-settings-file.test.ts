import { defaultSettings } from "@ivin/contracts/setting"
import { expect, test } from "vitest"
import { readSettingsFile } from "./read-settings-file.ts"

const initial = { settings: defaultSettings, problem: null }

test("a missing or empty file holds the default settings, every one on", () => {
  expect(readSettingsFile(initial, null)).toEqual(initial)
  expect(readSettingsFile(initial, " \n")).toEqual(initial)
  expect(defaultSettings).toEqual({
    tabs: { stopAgentOnClose: true },
    worktrees: { removeOnTabClose: true },
  })
})

test("a setting in the file replaces its default, and one left out falls back to it", () => {
  const off = {
    settings: { tabs: { stopAgentOnClose: false }, worktrees: { removeOnTabClose: false } },
    problem: null,
  }
  const text = `{
    // keep agents running
    "tabs": { "stopAgentOnClose": false, },
    "editor": { "fontSize": 13 },
  }`
  expect(readSettingsFile(off, text)).toEqual({
    settings: { tabs: { stopAgentOnClose: false }, worktrees: { removeOnTabClose: true } },
    problem: null,
  })
})

test("an invalid file keeps the previous settings and names its problem", () => {
  const previous = {
    settings: { tabs: { stopAgentOnClose: false }, worktrees: { removeOnTabClose: true } },
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
})
