import { expect, test } from "vitest"
import { errorReport, thrownByPlugin } from "./error-report.ts"

test("an error becomes a report with its name, message and stack", () => {
  const error = new TypeError("x is undefined")

  expect(errorReport("uncaught error", error)).toEqual({
    action: "uncaught error",
    type: "TypeError",
    message: "x is undefined",
    stack: error.stack,
  })
})

test("a tagged error gives its tag as type, and a bare value its own type", () => {
  expect(errorReport("project.select", { _tag: "ProjectNotOpen", path: "/a" })).toEqual({
    action: "project.select",
    type: "ProjectNotOpen",
    message: '{"_tag":"ProjectNotOpen","path":"/a"}',
  })
  expect(errorReport("unhandled rejection", "nope")).toEqual({
    action: "unhandled rejection",
    type: "string",
    message: "nope",
  })
})

test("an error whose file or first stack frame is under plugins/<id>/ comes from a plugin", () => {
  expect(thrownByPlugin("http://localhost:5173/plugins/usage/src/ui.tsx", null)).toBe(true)
  expect(
    thrownByPlugin(undefined, {
      stack:
        "Error: x\n    at onClick (http://localhost:5173/plugins/usage/src/ui.tsx:3:9)\n    at app.tsx:1",
    }),
  ).toBe(true)
  expect(
    thrownByPlugin("http://localhost:5173/src/app/app.tsx", {
      stack:
        "Error: x\n    at run (http://localhost:5173/src/app/app.tsx:3:9)\n    at /plugins/usage/src/ui.tsx:1",
    }),
  ).toBe(false)
})
