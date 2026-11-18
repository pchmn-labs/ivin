import { expect, test } from "vitest"
import { isFetchRecent, worktreeBase } from "./worktree-base.ts"

test("a new worktree starts from origin's default branch", () => {
  expect(
    worktreeBase({ hasOrigin: true, originHead: "origin/trunk", remote: ["origin/trunk"] }),
  ).toBe("origin/trunk")
})

test("without origin's HEAD, origin/main then origin/master is the base", () => {
  expect(
    worktreeBase({ hasOrigin: true, originHead: null, remote: ["origin/master", "origin/main"] }),
  ).toBe("origin/main")
  expect(worktreeBase({ hasOrigin: true, originHead: null, remote: ["origin/master"] })).toBe(
    "origin/master",
  )
  expect(worktreeBase({ hasOrigin: true, originHead: null, remote: ["origin/dev"] })).toBeNull()
})

test("a repository with no origin starts from the checkout's HEAD", () => {
  expect(worktreeBase({ hasOrigin: false, originHead: null, remote: [] })).toBe("HEAD")
})

test("a fetch younger than two minutes is reused", () => {
  const now = 1_000_000
  expect(isFetchRecent(undefined, now)).toBe(false)
  expect(isFetchRecent(now - 119_000, now)).toBe(true)
  expect(isFetchRecent(now - 120_000, now)).toBe(false)
})
