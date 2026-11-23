import { expect, test } from "vitest"
import { countOf } from "./count-of.ts"

test("a whole number of at least the minimum is read, spaces around it ignored", () => {
  expect(countOf("10", 0)).toBe(10)
  expect(countOf(" 0 ", 0)).toBe(0)
  expect(countOf("007", 0)).toBe(7)
  expect(countOf("3", 5)).toBeNull()
})

test("anything else is refused", () => {
  for (const text of ["", " ", "-1", "1.5", "1e3", "ten", "10 min", "99999999999999999999"]) {
    expect(countOf(text, 0)).toBeNull()
  }
})
