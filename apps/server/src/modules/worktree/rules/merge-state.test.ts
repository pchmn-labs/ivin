import { expect, test } from "vitest"
import { hasOwnCommits, isSquashMerged, mergeAddsNothing } from "./merge-state.ts"

test("a branch still at its fork point, on the target's first-parent line, has no commits of its own", () => {
  expect(hasOwnCommits("c2", "c2", ["c3", "c2", "c1"])).toBe(false)
})

test("a branch ahead of its fork point, or landed by a merge commit, has commits of its own", () => {
  expect(hasOwnCommits("b1", "c2", ["c3", "c2"])).toBe(true)
  expect(hasOwnCommits("b1", "b1", ["m1", "c2"])).toBe(true)
})

test("a merge whose tree is the target's own adds nothing", () => {
  expect(mergeAddsNothing("tree1\n", "tree1")).toBe(true)
  expect(mergeAddsNothing("tree2\n", "tree1")).toBe(false)
  expect(mergeAddsNothing(null, "tree1")).toBe(false)
})

test("a branch is squash merged when a target commit has its whole diff's patch id", () => {
  expect(isSquashMerged(["p1"], ["p0", "p1"])).toBe(true)
  expect(isSquashMerged(["p1"], ["p0"])).toBe(false)
  expect(isSquashMerged([], [])).toBe(false)
})
