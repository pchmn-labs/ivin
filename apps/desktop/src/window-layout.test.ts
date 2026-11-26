import { expect, test } from "vitest"
import { windowLayoutFrom } from "./window-layout.ts"

test("the window opens on the layout the settings file names, else on Two panels", () => {
  expect(windowLayoutFrom('{\n  // edge to edge\n  "window": { "layout": "plane", },\n}')).toBe(
    "plane",
  )
  expect(windowLayoutFrom('{ "window": { "layout": "panels" } }')).toBe("panels")
  for (const file of [
    null,
    "{ nope",
    "[]",
    "3",
    '{ "window": 3 }',
    '{ "window": { "layout": "x" } }',
  ]) {
    expect(windowLayoutFrom(file)).toBe("panels")
  }
})
