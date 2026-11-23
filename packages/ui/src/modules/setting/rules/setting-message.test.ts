import { SettingsFileInvalid } from "@ivin/contracts/setting"
import { expect, test } from "vitest"
import { saveFailureMessage, settingsProblemMessage } from "./setting-message.ts"

test("a file that is not JSON, or holds no object, is named with what is wrong", () => {
  expect(settingsProblemMessage({ reason: "notJson", setting: null })).toBe(
    "~/.ivin/settings.json is not valid JSON.",
  )
  expect(settingsProblemMessage({ reason: "notAnObject", setting: null })).toBe(
    "~/.ivin/settings.json does not hold an object.",
  )
})

test("an invalid setting is named by its key and the type it takes", () => {
  expect(
    settingsProblemMessage({ reason: "invalidSetting", setting: "tabs.stopAgentOnClose" }),
  ).toBe("tabs.stopAgentOnClose in ~/.ivin/settings.json takes true or false.")
  expect(settingsProblemMessage({ reason: "invalidSetting", setting: "sidebar.layout" })).toBe(
    'sidebar.layout in ~/.ivin/settings.json takes "rail" or "strip".',
  )
  expect(
    settingsProblemMessage({ reason: "invalidSetting", setting: "agents.stopWhenIdleMinutes" }),
  ).toBe(
    "agents.stopWhenIdleMinutes in ~/.ivin/settings.json takes a whole number of minutes, 0 or more.",
  )
  expect(settingsProblemMessage({ reason: "invalidSetting", setting: "tabs" })).toBe(
    "tabs in ~/.ivin/settings.json takes an object of settings.",
  )
  expect(settingsProblemMessage({ reason: "invalidSetting", setting: null })).toBe(
    "~/.ivin/settings.json holds a setting of the wrong type.",
  )
})

test("a save refused because the file is invalid says to fix the file first", () => {
  const error = new SettingsFileInvalid({
    path: "/u/.ivin/settings.json",
    reason: "notJson",
    parseError: null,
  })
  expect(saveFailureMessage(error)).toBe(
    "Not saved: ~/.ivin/settings.json is not valid JSON. Fix it, then try again.",
  )
})

test("any other failed save says the setting was not saved", () => {
  expect(saveFailureMessage(new Error("EACCES"))).toBe("The setting was not saved.")
})

test("an unreadable or unwritable file says what ivin could not do", () => {
  expect(saveFailureMessage({ _tag: "SettingsFileUnavailable", path: "/x", action: "write" })).toBe(
    "Not saved: ivin could not write ~/.ivin/settings.json. Check that it and its folder are accessible to you, then try again.",
  )
})
