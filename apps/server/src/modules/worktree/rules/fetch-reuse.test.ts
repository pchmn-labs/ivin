import { expect, test } from "vitest"
import { isFetchRecent } from "./fetch-reuse.ts"

test("a fetch younger than two minutes is reused", () => {
  const now = 1_000_000
  expect(isFetchRecent(undefined, now)).toBe(false)
  expect(isFetchRecent(now - 119_000, now)).toBe(true)
  expect(isFetchRecent(now - 120_000, now)).toBe(false)
})
