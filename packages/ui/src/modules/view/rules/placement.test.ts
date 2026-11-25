import { expect, test } from "vitest"
import { moveTargets, resolvePlacement } from "./placement.ts"

const view = { placements: ["subView", "sheet"], defaultPlacement: "subView" } as const

test("the setting wins over the caller and the default", () => {
  expect(resolvePlacement(view, "sheet", "subView")).toBe("sheet")
})

test("the caller wins over the default", () => {
  expect(resolvePlacement(view, undefined, "sheet")).toBe("sheet")
})

test("the default applies when neither is given", () => {
  expect(resolvePlacement(view, undefined, undefined)).toBe("subView")
})

test("a placement outside the view's list falls back to the next one", () => {
  expect(resolvePlacement(view, "dialog", "sheet")).toBe("sheet")
  expect(resolvePlacement(view, "dialog", "dialog")).toBe("subView")
  expect(resolvePlacement(view, 3, undefined)).toBe("subView")
})

test("a view moves to each of its placements but the one it is in", () => {
  expect(moveTargets({ placements: ["subView", "sheet", "dialog"] }, "sheet")).toEqual([
    "subView",
    "dialog",
  ])
  expect(moveTargets({ placements: ["subView"] }, "subView")).toEqual([])
})

test("a view no plugin declares moves nowhere", () => {
  expect(moveTargets(undefined, "subView")).toEqual([])
})
