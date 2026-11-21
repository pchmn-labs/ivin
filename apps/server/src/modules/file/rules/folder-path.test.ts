import { expect, test } from "vitest"
import { isWithin, relativeNames } from "./folder-path.ts"

test("a relative path keeps its names, without empty or current-folder ones", () => {
  expect(relativeNames("")).toEqual([])
  expect(relativeNames("src//lib/./a.ts")).toEqual(["src", "lib", "a.ts"])
  expect(relativeNames("src/")).toEqual(["src"])
})

test("a path that could leave the working folder has no names", () => {
  expect(relativeNames("..")).toBeNull()
  expect(relativeNames("src/../..")).toBeNull()
  expect(relativeNames("/etc")).toBeNull()
  expect(relativeNames("src\\..\\..")).toBeNull()
  expect(relativeNames("a\0b")).toBeNull()
})

test("a path is within a folder only below it, not beside it with the same prefix", () => {
  expect(isWithin("/repo", "/repo")).toBe(true)
  expect(isWithin("/repo", "/repo/src")).toBe(true)
  expect(isWithin("/repo", "/repo-other")).toBe(false)
  expect(isWithin("/", "/etc")).toBe(true)
})
