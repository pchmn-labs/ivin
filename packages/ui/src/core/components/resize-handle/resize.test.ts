import { expect, test } from "vitest"
import { clampSize, draggedSize } from "./resize.ts"

test("a size stays between its bounds, and a max under the min gives the min", () => {
  expect(clampSize(100, 240, 480)).toBe(240)
  expect(clampSize(600, 240, 480)).toBe(480)
  expect(clampSize(300.4, 240, 480)).toBe(300)
  expect(clampSize(300, 240, 120)).toBe(240)
})

test("a right edge grows when dragged right, a top edge when dragged up", () => {
  expect(draggedSize(300, { x: 10, y: 50 }, { x: 60, y: 0 }, "right")).toBe(350)
  expect(draggedSize(200, { x: 10, y: 50 }, { x: 60, y: 0 }, "top")).toBe(250)
})
