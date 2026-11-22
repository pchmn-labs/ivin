import { expect, test } from "vitest"
import { limitFiles } from "./file-list.ts"

test("paths are deduplicated and sorted", () => {
  expect(limitFiles(["b.ts", "src/a.ts", "a.ts", "b.ts"], 10)).toEqual({
    paths: ["a.ts", "b.ts", "src/a.ts"],
    truncated: false,
  })
})

test("a list over the limit is cut to it, and a list at the limit is not", () => {
  expect(limitFiles(["c", "a", "b"], 2)).toEqual({ paths: ["a", "b"], truncated: true })
  expect(limitFiles(["c", "a", "b"], 3)).toEqual({ paths: ["a", "b", "c"], truncated: false })
})
