import { expect, test } from "vitest"
import { newSessionModel } from "./harnesses.ts"

test("a new session takes the harness's default model until one is picked", () => {
  expect(newSessionModel("claude", null)).toBe("sonnet")
  expect(newSessionModel("claude", "opus")).toBe("opus")
})

test("a model picked for another harness falls back to the harness's default", () => {
  expect(newSessionModel("codex", "opus")).toBe("gpt-5-codex")
})
