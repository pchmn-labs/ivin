import { expect, test } from "vitest"
import { defaultSettings, settingSections } from "./setting.ts"

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
