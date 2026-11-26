import { expect, test } from "vitest"
import { defaultSettings, defaultSettingsFor, settingSections } from "./setting.ts"

const leafPaths = (value: object, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null
      ? leafPaths(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )

test("every setting has a label and a description, once, in the section of its first key", () => {
  const described = settingSections.flatMap((section) =>
    section.settings.map((setting) => {
      expect(setting.path.split(".")[0]).toBe(section.key)
      expect(setting.label).not.toBe("")
      expect(setting.description).not.toBe("")
      return setting.path
    }),
  )
  expect(described.toSorted()).toEqual(leafPaths(defaultSettings).toSorted())
})

test("the idle stop is shown to a number input as minutes, 0 or more", () => {
  const setting = settingSections
    .flatMap((section) => section.settings)
    .find((s) => s.path === "agents.stopWhenIdleMinutes")
  expect(setting?.count).toEqual({ min: 0, unit: "minutes" })
})

test("betas are on by default only when the installed version is itself a beta", () => {
  expect(defaultSettingsFor("0.1.0-beta.0").updates.beta).toBe(true)
  expect(defaultSettingsFor("0.1.0").updates.beta).toBe(false)
  expect(defaultSettingsFor("0.0.0").updates).toEqual(defaultSettings.updates)
})
