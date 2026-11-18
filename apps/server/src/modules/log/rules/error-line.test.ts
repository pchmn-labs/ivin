import { expect, test } from "vitest"
import { errorLine } from "./error-line.ts"

const at = new Date("2026-11-18T10:00:00.000Z")

test("a tagged error gives its tag as type, with its message and stack", () => {
  const error = { _tag: "ProjectNotOpen", message: "not open", stack: "at a" }

  expect(JSON.parse(errorLine(at, "server", "project.select", error))).toEqual({
    time: "2026-11-18T10:00:00.000Z",
    source: "server",
    action: "project.select",
    type: "ProjectNotOpen",
    message: "not open",
    stack: "at a",
  })
})

test("a plain Error gives its name as type", () => {
  const line = JSON.parse(errorLine(at, "ui", "uncaught error", new TypeError("x is undefined")))

  expect(line).toMatchObject({ source: "ui", type: "TypeError", message: "x is undefined" })
  expect(line.stack).toContain("TypeError")
})

test("a value that is not an error is written as it is, with no stack", () => {
  expect(JSON.parse(errorLine(at, "server", "a", "boom"))).toEqual({
    time: "2026-11-18T10:00:00.000Z",
    source: "server",
    action: "a",
    type: "string",
    message: "boom",
  })
  expect(JSON.parse(errorLine(at, "server", "a", { _tag: "Empty" })).message).toBe(
    '{"_tag":"Empty"}',
  )
})
