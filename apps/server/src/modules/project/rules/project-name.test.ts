import { expect, test } from "vitest"
import { projectName } from "./project-name.ts"

test.each([
  ["/Users/paul/Dev/ivin", "ivin"],
  ["/Users/paul/Dev/ivin/", "ivin"],
  ["C:\\Users\\paul\\ivin\\", "ivin"],
  ["ivin", "ivin"],
  ["/", "/"],
])("the name of %s is %s", (path, name) => {
  expect(projectName(path)).toBe(name)
})
