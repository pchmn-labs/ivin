import { expect, test } from "vitest"
import { formatUsage } from "./total-usage.ts"

test("the total reads as thousands-separated tokens and four decimals of dollars", () => {
  expect(formatUsage({ tokens: 1540, costUsd: 0.0123 })).toBe("1,540 tokens · $0.0123")
})
