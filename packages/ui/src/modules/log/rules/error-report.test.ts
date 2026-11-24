import { expect, test } from "vitest"
import { errorReport, pluginOfError } from "./error-report.ts"

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

test("an error is a plugin's when its file or first stack frame is that plugin's bundle", () => {
  const bundles = new Map([["a b.js", "notes"]])
  const url = "ivin-plugin-bundle://cache/a%20b.js"

  expect(pluginOfError(url, null, bundles)).toBe("notes")
  expect(
    pluginOfError(
      undefined,
      { stack: `Error: x\n    at onClick (${url}:3:9)\n    at app.tsx:1` },
      bundles,
    ),
  ).toBe("notes")
  expect(
    pluginOfError(
      "http://localhost/src/app/app.tsx",
      { stack: `Error: x\n    at run (http://localhost/src/app.tsx:3:9)\n    at ${url}:1` },
      bundles,
    ),
  ).toBeNull()
  expect(
    pluginOfError("http://localhost/plugins/usage/src/ui.tsx", new Error("x"), bundles),
  ).toBeNull()
})
