import { expect, test } from "vitest"
import { titleFromMessage } from "./session-title.ts"

test("the title is the first non-empty line of the message, trimmed", () => {
  expect(titleFromMessage("  \n  Fix the login bug  \nand add a test")).toBe("Fix the login bug")
})

test("a long first line is truncated with an ellipsis", () => {
  const title = titleFromMessage("a".repeat(200))

  expect(title).toHaveLength(60)
  expect(title.endsWith("…")).toBe(true)
})

test("a blank message gives an empty title", () => {
  expect(titleFromMessage("  \n ")).toBe("")
})
