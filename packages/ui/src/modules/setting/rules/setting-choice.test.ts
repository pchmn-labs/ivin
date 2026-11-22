import { expect, test } from "vitest"
import { shownSetting } from "./setting-choice.ts"

const file = (value: unknown, version: number) => ({ value, version })

test("with no choice pending, the switch shows the file's value", () => {
  expect(shownSetting(file(true, 1), null)).toEqual({ value: true, saving: false, failure: null })
})

test("while saving, and until the file changes, the switch shows the user's choice", () => {
  expect(
    shownSetting(file(true, 1), { value: false, fileVersion: 1, state: "saving", failure: null }),
  ).toEqual({ value: false, saving: true, failure: null })
  expect(
    shownSetting(file(true, 1), { value: false, fileVersion: 1, state: "saved", failure: null }),
  ).toEqual({ value: false, saving: false, failure: null })
})

test("a failed save keeps the user's choice with its message", () => {
  expect(
    shownSetting(file(true, 1), { value: false, fileVersion: 1, state: "failed", failure: "No." }),
  ).toEqual({ value: false, saving: false, failure: "No." })
})

test("once the file changes, from the save or from elsewhere, the file's value wins", () => {
  const saved = { value: false, fileVersion: 1, state: "saved", failure: null } as const
  expect(shownSetting(file(false, 2), saved).value).toBe(false)
  // The CLI puts the old value back after the save landed.
  expect(shownSetting(file(true, 3), saved).value).toBe(true)
  expect(
    shownSetting(file(true, 2), { value: false, fileVersion: 1, state: "failed", failure: "No." }),
  ).toEqual({ value: true, saving: false, failure: null })
})
