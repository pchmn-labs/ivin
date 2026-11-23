import { expect, test } from "vitest"
import { createRestartPolicy } from "./restart-policy.ts"

test("a server that answered is restarted up to 3 times in a minute", () => {
  const next = createRestartPolicy()
  expect([0, 10_000, 20_000, 30_000].map((now) => next(now, true))).toEqual([
    "restart",
    "restart",
    "restart",
    "give-up",
  ])
})

test("a stop a minute after the first restart is counted afresh", () => {
  const next = createRestartPolicy()
  next(0, true)
  next(10_000, true)
  next(20_000, true)
  expect(next(60_000, true)).toBe("restart")
})

test("a server that stopped before it answered is not restarted", () => {
  expect(createRestartPolicy()(0, false)).toBe("give-up")
})
