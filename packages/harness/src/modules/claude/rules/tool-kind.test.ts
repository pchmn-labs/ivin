import { expect, test } from "vitest"
import { toolKind } from "./tool-kind.ts"

test("classifies Claude Code's tools by what they do", () => {
  expect(
    ["Bash", "Read", "Edit", "Write", "Grep", "Glob", "Skill", "Task", "Agent"].map(toolKind),
  ).toEqual(["command", "read", "edit", "edit", "search", "search", "skill", "agent", "agent"])
})

test("a tool it does not know is other", () => {
  expect(toolKind("WebFetch")).toBe("other")
})
