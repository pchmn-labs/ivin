import { expect, test } from "vitest"
import { foldText, mainArgument, prettyInput } from "./tool-output.ts"

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

test.each([
  ["Bash", { command: "ls -la" }, "ls -la"],
  ["Read", { file_path: "/a.ts" }, "/a.ts"],
  ["Edit", { file_path: "/a.ts", old_string: "x", new_string: "y" }, "/a.ts"],
  ["MultiEdit", { file_path: "/c.ts", edits: [] }, "/c.ts"],
  ["Grep", { pattern: "foo" }, "foo"],
  ["Glob", { pattern: "**/*.ts" }, "**/*.ts"],
  ["WebFetch", { url: "https://a.dev" }, "https://a.dev"],
  ["Task", { description: "Find it", prompt: "long" }, "Find it"],
])("%s shows its main argument", (name, input, expected) => {
  expect(mainArgument(name, input)).toBe(expected)
})

test("an unknown tool or a missing argument has no main argument", () => {
  expect(mainArgument("Custom", { a: 1 })).toBeNull()
  expect(mainArgument("Bash", {})).toBeNull()
  expect(mainArgument("Bash", undefined)).toBeNull()
})

test("the full input is indented JSON", () => {
  expect(prettyInput({ a: 1 })).toBe('{\n  "a": 1\n}')
  expect(prettyInput(undefined)).toBe("")
})
