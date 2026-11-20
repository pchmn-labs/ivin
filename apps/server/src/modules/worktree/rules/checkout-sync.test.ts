import { expect, test } from "vitest"
import { defaultBranchName, fastForwardCount, isBlockedByLocalChanges } from "./checkout-sync.ts"

test("the default branch is origin's, by its local name", () => {
  expect(defaultBranchName("origin/main")).toBe("main")
  expect(defaultBranchName("origin/release/2")).toBe("release/2")
  expect(defaultBranchName("HEAD")).toBeNull()
  expect(defaultBranchName(null)).toBeNull()
})

test("a branch counts the commits it can fast-forward, none once it has its own", () => {
  expect(fastForwardCount({ ahead: 0, behind: 3 })).toBe(3)
  expect(fastForwardCount({ ahead: 1, behind: 3 })).toBe(0)
  expect(fastForwardCount({ ahead: 0, behind: 0 })).toBe(0)
})

test("git's refusals over local changes are told apart from the others", () => {
  expect(
    isBlockedByLocalChanges(
      "error: Your local changes to the following files would be overwritten by merge:\n\ta.txt",
    ),
  ).toBe(true)
  expect(
    isBlockedByLocalChanges(
      "error: The following untracked working tree files would be overwritten by merge:\n\ta.txt",
    ),
  ).toBe(true)
  expect(isBlockedByLocalChanges("fatal: Not possible to fast-forward, aborting.")).toBe(false)
})
