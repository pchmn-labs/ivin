import { expect, test } from "vitest"
import { formatInput } from "./format-input.ts"

test("an input is shown as compact JSON", () => {
  expect(formatInput({ command: "ls" })).toBe('{"command":"ls"}')
})

test("an undefined input is shown as empty text", () => {
  expect(formatInput(undefined)).toBe("")
})
