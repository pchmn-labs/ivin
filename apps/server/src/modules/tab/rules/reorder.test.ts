import { expect, test } from "vitest"
import { reorder } from "./reorder.ts"

test.each([
  [
    ["a", "b", "c"],
    ["c", "a", "b"],
    ["c", "a", "b"],
  ],
  [
    ["a", "b", "c", "d"],
    ["c", "a"],
    ["c", "a", "b", "d"],
  ],
  [
    ["a", "b", "c"],
    ["c", "x", "a"],
    ["c", "a", "b"],
  ],
  [
    ["a", "b", "c"],
    ["b", "b"],
    ["b", "a", "c"],
  ],
  [["a", "b"], [], ["a", "b"]],
])("reordering %j by %j gives %j", (current, named, expected) => {
  expect(reorder(current, named)).toEqual(expected)
})
