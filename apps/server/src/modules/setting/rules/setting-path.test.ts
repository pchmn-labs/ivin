import { defaultSettings } from "@ivin/contracts/setting"
import { expect, test } from "vitest"
import { checkSetting, settingPaths, valueAt } from "./setting-path.ts"

test("the known paths are the dotted paths of the settings schema's leaves", () => {
  expect(settingPaths).toEqual([
    "tabs.stopAgentOnClose",
    "worktrees.removeOnTabClose",
    "files.folderIcons",
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

test("a value is read at a leaf or a section, and the whole settings at no path", () => {
  const settings = { ...defaultSettings, tabs: { stopAgentOnClose: false } }
  expect(valueAt(settings, null)).toEqual(settings)
  expect(valueAt(settings, "tabs")).toEqual({ stopAgentOnClose: false })
  expect(valueAt(settings, "tabs.stopAgentOnClose")).toBe(false)
  expect(valueAt(settings, "tabs.nope")).toBeUndefined()
  expect(valueAt(settings, "tabs.stopAgentOnClose.x")).toBeUndefined()
  expect(valueAt(settings, "toString")).toBeUndefined()
})
