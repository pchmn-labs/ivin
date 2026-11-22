import { expect, test } from "vitest"
import type { TranscriptItem } from "@ivin/plugin-api/ui"
import { formatUsage, totalUsage } from "./total-usage.ts"

const usage = (
  position: number,
  inputTokens: number,
  outputTokens: number,
  costUsd: number | null,
) =>
  ({
    id: `u${position}`,
    sessionId: "s",
    position,
    at: 0,
    type: "usage",
    inputTokens,
    outputTokens,
    costUsd,
  }) satisfies TranscriptItem

test("the total sums input and output tokens and the cost of every usage item", () => {
  const total = totalUsage([
    usage(0, 1000, 200, 0.01),
    {
      id: "m",
      sessionId: "s",
      position: 1,
      at: 0,
      type: "message",
      role: "user",
      text: "hi",
      images: [],
      steer: false,
    },
    usage(2, 300, 40, 0.0023),
  ])
  expect(total?.tokens).toBe(1540)
  expect(total?.costUsd).toBeCloseTo(0.0123)
})

test("a usage item without a cost adds tokens but no cost", () => {
  const total = totalUsage([usage(0, 100, 20, null), usage(1, 10, 5, 0.5)])
  expect(total).toEqual({ tokens: 135, costUsd: 0.5 })
})

test("there is no total without a usage item", () => {
  expect(totalUsage([])).toBeNull()
})

test("the total reads as thousands-separated tokens and four decimals of dollars", () => {
  expect(formatUsage({ tokens: 1540, costUsd: 0.0123 })).toBe("1,540 tokens · $0.0123")
})
