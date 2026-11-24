import { expect, test } from "vitest"
import { moveBy, moveTab, reorder } from "./reorder.ts"

test("moving a tab before or after another", () => {
  expect(moveTab(["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"])
  expect(moveTab(["a", "b", "c"], "a", "c", "after")).toEqual(["b", "c", "a"])
  expect(moveTab(["a", "b", "c"], "a", "b", "after")).toEqual(["b", "a", "c"])
  expect(moveTab(["a", "b", "c"], "b", "b", "before")).toEqual(["a", "b", "c"])
})

test("named ids come first, the others follow in their order", () => {
  expect(reorder(["a", "b", "c"], ["c"])).toEqual(["c", "a", "b"])
})

test("duplicate and unknown ids are dropped", () => {
  expect(reorder(["a", "b", "c"], ["c", "x", "c", "a"])).toEqual(["c", "a", "b"])
})

test("a tab moves one place either way and stays at either end", () => {
  expect(moveBy(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"])
  expect(moveBy(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"])
  expect(moveBy(["a", "b", "c"], "a", -1)).toBeNull()
  expect(moveBy(["a", "b", "c"], "c", 1)).toBeNull()
  expect(moveBy(["a", "b", "c"], "x", 1)).toBeNull()
})
