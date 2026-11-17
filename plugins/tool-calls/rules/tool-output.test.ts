import { expect, test } from "vitest"
import { foldText } from "./tool-output.ts"

test("short output is not folded", () => {
  expect(foldText("a\nb")).toEqual({ folded: false, preview: "a\nb" })
})

test("long output is folded to its first lines", () => {
  const output = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n")
  const result = foldText(output)
  expect(result.folded).toBe(true)
  expect(result.preview.split("\n")).toHaveLength(3)
})

test("a long single line is folded by length", () => {
  expect(foldText("x".repeat(2000))).toMatchObject({ folded: true })
})
