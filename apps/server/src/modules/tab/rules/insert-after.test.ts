import { expect, test } from "vitest"
import { insertAfter } from "./insert-after.ts"

test("puts the tab right after the named one", () => {
  expect(insertAfter(["a", "b", "c", "n"], "n", "a")).toEqual(["a", "n", "b", "c"])
})

test("keeps the tab at the end when the named one is the last", () => {
  expect(insertAfter(["a", "b", "n"], "n", "b")).toEqual(["a", "b", "n"])
})

test("keeps the tab at the end when the named one is not in the bar", () => {
  expect(insertAfter(["a", "b", "n"], "n", "x")).toEqual(["a", "b", "n"])
})
