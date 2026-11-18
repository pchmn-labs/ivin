import { expect, test } from "vitest"
import { selectionAfterRemoval } from "./neighbour.ts"

test.each([
  [["a", "b", "c"], "b", "c"],
  [["a", "b", "c"], "c", "b"],
  [["a", "b", "c"], "a", "b"],
  [["a"], "a", null],
  [["a", "b"], "z", null],
])("removing %j's %s selects %s", (order, removed, expected) => {
  expect(selectionAfterRemoval(order, removed)).toBe(expected)
})
