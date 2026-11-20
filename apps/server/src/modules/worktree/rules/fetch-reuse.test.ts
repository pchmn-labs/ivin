import { expect, test } from "vitest"
import {
  BRANCH_LIST_FETCH_REUSE_MS,
  WORKTREE_FETCH_REUSE_MS,
  isFetchRecent,
} from "./fetch-reuse.ts"

const now = 1_000_000

test("a new worktree reuses a fetch younger than two minutes", () => {
  expect(isFetchRecent(undefined, now, WORKTREE_FETCH_REUSE_MS)).toBe(false)
  expect(isFetchRecent(now - 119_000, now, WORKTREE_FETCH_REUSE_MS)).toBe(true)
  expect(isFetchRecent(now - 120_000, now, WORKTREE_FETCH_REUSE_MS)).toBe(false)
})

test("the branch list reuses a fetch younger than a minute", () => {
  expect(isFetchRecent(now - 59_000, now, BRANCH_LIST_FETCH_REUSE_MS)).toBe(true)
  expect(isFetchRecent(now - 60_000, now, BRANCH_LIST_FETCH_REUSE_MS)).toBe(false)
})
