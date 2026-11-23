import { Schema } from "effect"
import { expect, test } from "vitest"
import { defaultSettings, settingSections, Settings } from "./setting.ts"

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

test("the idle stop is a whole number of minutes, 0 or more, that a number input can take", () => {
  const check = Schema.is(Settings.fields.agents.fields.stopWhenIdleMinutes)
  expect([0, 10, 90].every(check)).toBe(true)
  expect([-1, 1.5, "10", null].some(check)).toBe(false)
  const setting = settingSections
    .flatMap((section) => section.settings)
    .find((s) => s.path === "agents.stopWhenIdleMinutes")
  expect(setting?.count).toEqual({ min: 0, unit: "minutes" })
  expect(defaultSettings.agents.stopWhenIdleMinutes).toBe(10)
})
