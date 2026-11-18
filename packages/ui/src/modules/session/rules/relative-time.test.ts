import { expect, test } from "vitest"
import { relativeTime } from "./relative-time.ts"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

test("under a minute reads now", () => {
  expect(relativeTime(0, 59_000)).toBe("now")
})

test("a future time reads now", () => {
  expect(relativeTime(10_000, 0)).toBe("now")
})

test("minutes, hours and days round down", () => {
  expect(relativeTime(0, 5 * MINUTE + 30_000)).toBe("5 min")
  expect(relativeTime(0, 59 * MINUTE)).toBe("59 min")
  expect(relativeTime(0, 2 * HOUR + MINUTE)).toBe("2 h")
  expect(relativeTime(0, 23 * HOUR)).toBe("23 h")
  expect(relativeTime(0, 3 * DAY + HOUR)).toBe("3 d")
})
