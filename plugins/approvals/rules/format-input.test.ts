import { expect, test } from "vitest"
import { formatInput } from "./format-input.ts"

test.each([
  ["Bash", { command: "ls -la" }, "ls -la"],
  ["Read", { file_path: "/a.ts" }, "/a.ts"],
  ["Edit", { file_path: "/a.ts", old_string: "x", new_string: "y" }, "/a.ts"],
  ["Write", { file_path: "/b.ts", content: "z" }, "/b.ts"],
  ["MultiEdit", { file_path: "/c.ts", edits: [] }, "/c.ts"],
  ["Grep", { pattern: "foo" }, "foo"],
  ["Glob", { pattern: "**/*.ts" }, "**/*.ts"],
  ["WebFetch", { url: "https://a.dev" }, "https://a.dev"],
  ["Task", { description: "Find it", prompt: "long" }, "Find it"],
])("%s shows its main argument", (name, input, expected) => {
  expect(formatInput(name, input)).toBe(expected)
})

test("an unknown tool falls back to indented JSON", () => {
  expect(formatInput("Custom", { a: 1 })).toBe('{\n  "a": 1\n}')
})

test("a known tool without its main argument falls back to JSON", () => {
  expect(formatInput("Bash", {})).toBe("{}")
})

test("an undefined input is shown as empty text", () => {
  expect(formatInput("Bash", undefined)).toBe("")
})
