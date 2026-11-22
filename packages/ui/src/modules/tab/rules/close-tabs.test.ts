import { expect, test } from "vitest"
import type { ProjectTabs } from "@ivin/contracts/tab"
import { closeTabs, reopenTab } from "./close-tabs.ts"

const bar = (ids: ReadonlyArray<string>, selected: string | null): ProjectTabs => ({
  projectPath: "/p",
  tabs: ids.map((sessionId) => ({ sessionId, projectPath: "/p" })),
  selectedSessionId: selected,
})

test.each([
  [["a", "b", "c"], "b", ["b"], ["a", "c"], "c"],
  [["a", "b", "c"], "c", ["c"], ["a", "b"], "b"],
  [["a", "b", "c"], "a", ["b"], ["a", "c"], "a"],
  [["a", "b", "c"], "a", ["a", "b"], ["c"], "c"],
  [["a"], "a", ["a"], [], null],
  [["a", "b"], "a", ["z"], ["a", "b"], "a"],
])(
  "closing %j with %s selected, minus %j, leaves %j with %s selected",
  (ids, selected, closed, left, next) => {
    expect(closeTabs(bar(ids, selected), new Set(closed))).toEqual(bar(left, next))
  },
)

test("a tab whose close failed comes back at its place, selected if it was", () => {
  const before = bar(["a", "b", "c"], "b")
  expect(reopenTab(closeTabs(before, new Set(["b"])), before, "b")).toEqual(before)
  expect(reopenTab(bar(["a", "c"], "a"), bar(["a", "b", "c"], "a"), "b")).toEqual(
    bar(["a", "b", "c"], "a"),
  )
})

test("a tab back already is left as is", () => {
  expect(reopenTab(bar(["a", "b"], "a"), bar(["a", "b"], "b"), "b")).toEqual(bar(["a", "b"], "a"))
})
