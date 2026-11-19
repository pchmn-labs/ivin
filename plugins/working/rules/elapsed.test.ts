import { expect, test } from "vitest"
import { elapsed } from "./elapsed.ts"

test("the elapsed time reads in the largest whole unit", () => {
  const minute = 60_000
  expect(elapsed(0, 59_999)).toBe("now")
  expect(elapsed(0, minute)).toBe("1 min")
  expect(elapsed(0, 59 * minute)).toBe("59 min")
  expect(elapsed(0, 60 * minute)).toBe("1 h")
  expect(elapsed(0, 48 * 60 * minute)).toBe("2 d")
  expect(elapsed(10, 0)).toBe("now")
})
