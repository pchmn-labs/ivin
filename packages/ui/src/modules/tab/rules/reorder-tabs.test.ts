import { expect, test } from "vitest"
import { moveTab, reorderTabs } from "./reorder-tabs.ts"

test("moving a tab before or after another", () => {
  expect(moveTab(["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"])
  expect(moveTab(["a", "b", "c"], "a", "c", "after")).toEqual(["b", "c", "a"])
  expect(moveTab(["a", "b", "c"], "a", "b", "after")).toEqual(["b", "a", "c"])
  expect(moveTab(["a", "b", "c"], "b", "b", "before")).toEqual(["a", "b", "c"])
})

test("named tabs come first, the others follow in their order", () => {
  const tabs = ["a", "b", "c"].map((sessionId) => ({ sessionId }))
  expect(reorderTabs(tabs, ["c"]).map((t) => t.sessionId)).toEqual(["c", "a", "b"])
})
