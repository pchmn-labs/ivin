import { expect, test } from "vitest"
import { toolIcon } from "./tool-icon.ts"

test("a tool's icon follows what it does, and a tool of no known kind gets the wrench", () => {
  expect(toolIcon("command")).toBe("terminal")
  expect(toolIcon("read")).toBe("file")
  expect(toolIcon("edit")).toBe("pencil")
  expect(toolIcon("agent")).toBe("robot")
  expect(toolIcon("other")).toBe("wrench")
})
