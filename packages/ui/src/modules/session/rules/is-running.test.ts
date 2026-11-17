import { expect, test } from "vitest"
import { isRunning } from "./is-running.ts"

test("a session runs while it works or waits for the user", () => {
  expect(isRunning("working")).toBe(true)
  expect(isRunning("waiting")).toBe(true)
  expect(isRunning("idle")).toBe(false)
  expect(isRunning("failed")).toBe(false)
  expect(isRunning(undefined)).toBe(false)
})
