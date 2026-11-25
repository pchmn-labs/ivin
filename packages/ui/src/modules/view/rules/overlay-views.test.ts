import { expect, test } from "vitest"
import { noSheetViews, withSheetViewClosed, withSheetViewOpen } from "./overlay-views.ts"

const a = { view: "t/v", params: { id: 1 } }
const b = { view: "t/v", params: { id: 2 } }

test("opening a view adds it and selects it", () => {
  const state = withSheetViewOpen(withSheetViewOpen(noSheetViews, a), b)
  expect(state.views).toEqual([a, b])
  expect(state.selected).toEqual(b)
})

test("opening an equal view selects it without adding one", () => {
  const state = withSheetViewOpen(withSheetViewOpen(withSheetViewOpen(noSheetViews, a), b), {
    view: "t/v",
    params: { id: 1 },
  })
  expect(state.views).toEqual([a, b])
  expect(state.selected).toEqual(a)
})

test("closing the selected view selects its neighbour", () => {
  const open = withSheetViewOpen(withSheetViewOpen(noSheetViews, a), b)
  expect(withSheetViewClosed(open, b).selected).toEqual(a)
  expect(withSheetViewClosed(withSheetViewClosed(open, b), a)).toEqual(noSheetViews)
})
