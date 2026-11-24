import { expect, test } from "vitest"
import { filePathArgument, mainArgument, prettyInput } from "./tool-output.ts"

test.each([
  ["Bash", { command: "ls -la" }, "ls -la"],
  ["Read", { file_path: "/a.ts" }, "/a.ts"],
  ["Edit", { file_path: "/a.ts", old_string: "x", new_string: "y" }, "/a.ts"],
  ["MultiEdit", { file_path: "/c.ts", edits: [] }, "/c.ts"],
  ["Grep", { pattern: "foo" }, "foo"],
  ["Glob", { pattern: "**/*.ts" }, "**/*.ts"],
  ["WebFetch", { url: "https://a.dev" }, "https://a.dev"],
  ["Task", { description: "Find it", prompt: "long" }, "Find it"],
  ["Agent", { description: "Build the server", prompt: "long" }, "Build the server"],
  ["Skill", { skill: "implement" }, "/implement"],
  ["Skill", { skill: "implement", args: "#122" }, "/implement #122"],
  ["Skill", { skill: "/implement" }, "/implement"],
])("%s shows its main argument", (name, input, expected) => {
  expect(mainArgument(name, input)).toBe(expected)
})

test("an unknown tool or a missing argument has no main argument", () => {
  expect(mainArgument("Custom", { a: 1 })).toBeNull()
  expect(mainArgument("Bash", {})).toBeNull()
  expect(mainArgument("Bash", undefined)).toBeNull()
  expect(mainArgument("Skill", { args: "#122" })).toBeNull()
})

test("the full input is indented JSON", () => {
  expect(prettyInput({ a: 1 })).toBe('{\n  "a": 1\n}')
  expect(prettyInput(undefined)).toBe("")
})

test("a tool that reads or writes a file names it as a path, any other tool does not", () => {
  expect(filePathArgument("Read", { file_path: "/a.ts" })).toBe("/a.ts")
  expect(filePathArgument("Edit", { file_path: "src/a.ts" })).toBe("src/a.ts")
  expect(filePathArgument("Write", { file_path: "/b.ts" })).toBe("/b.ts")
  expect(filePathArgument("MultiEdit", { file_path: "/c.ts" })).toBe("/c.ts")
  expect(filePathArgument("Bash", { command: "cat a.ts" })).toBeNull()
  expect(filePathArgument("Read", {})).toBeNull()
})
