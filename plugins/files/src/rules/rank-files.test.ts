import { expect, test } from "vitest"
import { indexFiles, rankFiles } from "./rank-files.ts"

const paths = [
  "apps/server/src/config.ts",
  "packages/ui/src/core/server-client.ts",
  "docs/conventions/README.md",
  "vite.config.ts",
  "src/c/o/n/f.ts",
]

const ranked = (query: string, limit = 10) =>
  rankFiles(indexFiles(paths), query, limit).map((r) => r.path)

test("a name that holds the letters in order matches; tighter matches come first", () => {
  expect(ranked("conf")).toEqual(["apps/server/src/config.ts", "vite.config.ts", "src/c/o/n/f.ts"])
})

test("letters spread over the path match after every name match", () => {
  const results = rankFiles(indexFiles(paths), "uiclient", 10)
  expect(results.map((r) => r.path)).toEqual(["packages/ui/src/core/server-client.ts"])
  expect(results[0]?.nameMatch).toBeNull()
})

test("a name match gives the positions of its letters in the name", () => {
  expect(rankFiles(indexFiles(paths), "vco", 10)[0]).toEqual({
    path: "vite.config.ts",
    nameMatch: [0, 5, 6],
  })
})

test("case and spaces are ignored, and the results stop at the limit", () => {
  expect(ranked("CON F", 2)).toEqual(["apps/server/src/config.ts", "vite.config.ts"])
})

test("an empty query lists the first files, in path order", () => {
  expect(ranked("", 2)).toEqual(["apps/server/src/config.ts", "docs/conventions/README.md"])
})

test("a query that extends the last one gives what a fresh search gives, and so does one that does not", () => {
  const index = indexFiles(paths)
  const asked = ["c", "co", "con", "conf", "co", "vc", "vco", "", "con f"]
  for (const query of asked)
    expect(rankFiles(index, query, 10)).toEqual(rankFiles(indexFiles(paths), query, 10))
})

test("the first results are the same whatever the limit", () => {
  const many = Array.from({ length: 300 }, (_, i) => `src/${i % 7}/co${"x".repeat(i % 5)}n-${i}.ts`)
  const index = indexFiles(many)
  for (const query of ["c", "con", "cn", "src", "s0c", "3"])
    expect(rankFiles(index, query, 5)).toEqual(rankFiles(indexFiles(many), query, 300).slice(0, 5))
})
