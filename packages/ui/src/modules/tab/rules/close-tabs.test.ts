import { expect, test } from "vitest"
import type { ProjectTabs } from "@ivin/contracts/tab"
import { closeTabs } from "./close-tabs.ts"

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
