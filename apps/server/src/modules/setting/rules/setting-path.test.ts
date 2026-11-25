import { defaultSettings } from "@ivin/contracts/setting"
import { expect, test } from "vitest"
import { checkSetting, settingPaths, valueAt } from "./setting-path.ts"

test("the known paths are the dotted paths of the settings schema's leaves", () => {
  expect(settingPaths).toEqual([
    "tabs.stopAgentOnClose",
    "tabs.newTabPosition",
    "worktrees.removeOnTabClose",
    "files.folderIcons",
    "sidebar.layout",
    "agents.stopWhenIdleMinutes",
    "updates.automaticCheck",
    "updates.beta",
  ])
})

test("a value of the setting's type is accepted, whatever path holds it", () => {
  expect(checkSetting("tabs.stopAgentOnClose", false)).toEqual({ ok: true })
  expect(checkSetting("worktrees.removeOnTabClose", true)).toEqual({ ok: true })
})

test("an unknown path, or one that names a section, is refused with the known paths", () => {
  for (const path of ["tabs.nope", "tabs", "", "tabs.stopAgentOnClose.x", "constructor"]) {
    expect(checkSetting(path, true)).toEqual({ ok: false, reason: "unknownPath" })
  }
})

test("a value of the wrong type is refused with the type the setting takes", () => {
  for (const value of ["maybe", "false", 0, null, { a: 1 }, [true]]) {
    expect(checkSetting("tabs.stopAgentOnClose", value)).toEqual({
      ok: false,
      reason: "invalidValue",
      expected: "boolean",
    })
  }
})

test("a setting with fixed values takes one of them and is refused with the list", () => {
  expect(checkSetting("sidebar.layout", "strip")).toEqual({ ok: true })
  for (const value of ["column", "Strip", true, null]) {
    expect(checkSetting("sidebar.layout", value)).toEqual({
      ok: false,
      reason: "invalidValue",
      expected: "oneOf",
      allowed: ["rail", "strip"],
    })
  }
})

test("a count of minutes takes a whole number of 0 or more", () => {
  for (const value of [0, 10, 120]) {
    expect(checkSetting("agents.stopWhenIdleMinutes", value)).toEqual({ ok: true })
  }
  for (const value of [-1, 1.5, "10", true, null]) {
    expect(checkSetting("agents.stopWhenIdleMinutes", value)).toEqual({
      ok: false,
      reason: "invalidValue",
      expected: "wholeNumber",
    })
  }
})

test("a value is read at a leaf or a section, and the whole settings at no path", () => {
  const settings = {
    ...defaultSettings,
    tabs: { ...defaultSettings.tabs, stopAgentOnClose: false },
  }
  expect(valueAt(settings, null)).toEqual(settings)
  expect(valueAt(settings, "tabs")).toEqual(settings.tabs)
  expect(valueAt(settings, "tabs.stopAgentOnClose")).toBe(false)
  expect(valueAt(settings, "tabs.nope")).toBeUndefined()
  expect(valueAt(settings, "tabs.stopAgentOnClose.x")).toBeUndefined()
  expect(valueAt(settings, "toString")).toBeUndefined()
})
