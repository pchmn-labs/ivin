import { expect, test } from "vitest"
import { rankFiles } from "./rank-files.ts"

const paths = [
  "apps/server/src/config.ts",
  "packages/ui/src/core/server-client.ts",
  "docs/conventions/README.md",
  "vite.config.ts",
  "src/c/o/n/f.ts",
]

const ranked = (query: string, limit = 10) => rankFiles(paths, query, limit).map((r) => r.path)

test("a name that holds the letters in order matches; tighter matches come first", () => {
  expect(ranked("conf")).toEqual(["apps/server/src/config.ts", "vite.config.ts", "src/c/o/n/f.ts"])
})

test("letters spread over the path match after every name match", () => {
  const results = rankFiles(paths, "uiclient", 10)
  expect(results.map((r) => r.path)).toEqual(["packages/ui/src/core/server-client.ts"])
  expect(results[0]?.nameMatch).toBeNull()
})

test("a name match gives the positions of its letters in the name", () => {
  expect(rankFiles(paths, "vco", 10)[0]).toEqual({ path: "vite.config.ts", nameMatch: [0, 5, 6] })
})

test("case and spaces are ignored, and the results stop at the limit", () => {
  expect(ranked("CON F", 2)).toEqual(["apps/server/src/config.ts", "vite.config.ts"])
})

test("an empty query lists the first files, in path order", () => {
  expect(ranked("", 2)).toEqual(["apps/server/src/config.ts", "docs/conventions/README.md"])
})
