import { expect, test } from "vitest"
import { toolIcon } from "./tool-icon.ts"

test("a known tool gets its own icon and any other tool the wrench", () => {
  expect(toolIcon("Bash")).toBe("terminal")
  expect(toolIcon("Read")).toBe("file")
  expect(toolIcon("Edit")).toBe("pencil")
  expect(toolIcon("Custom")).toBe("wrench")
})
