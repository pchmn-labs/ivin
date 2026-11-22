import { expect, test } from "vitest"
import { shownSetting } from "./setting-choice.ts"

const file = (value: unknown, version: number) => ({ value, version })

test("with no choice pending, the switch shows the file's value", () => {
  expect(shownSetting(file(true, 1), null)).toEqual({ value: true, failure: null })
})

test("until the file changes, the switch shows the user's choice", () => {
  expect(shownSetting(file(true, 1), { value: false, fileVersion: 1, failure: null })).toEqual({
    value: false,
    failure: null,
  })
})

test("a failed save keeps the user's choice with its message", () => {
  expect(shownSetting(file(true, 1), { value: false, fileVersion: 1, failure: "No." })).toEqual({
    value: false,
    failure: "No.",
  })
})

test("once the file changes, from the save or from elsewhere, the file's value wins", () => {
  const saved = { value: false, fileVersion: 1, failure: null }
  expect(shownSetting(file(false, 2), saved).value).toBe(false)
  // The CLI puts the old value back after the save landed.
  expect(shownSetting(file(true, 3), saved).value).toBe(true)
  expect(shownSetting(file(true, 2), { value: false, fileVersion: 1, failure: "No." })).toEqual({
    value: true,
    failure: null,
  })
})
