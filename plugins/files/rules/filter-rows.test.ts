import { expect, test } from "vitest"
import { filterRows } from "./filter-rows.ts"

const paths = ["README.md", "src/cart/cart.ts", "src/cart/total.ts", "src/main.ts", "docs/cart.md"]

const shown = (query: string) =>
  filterRows(paths, query, new Map()).map((row) => `${"  ".repeat(row.depth)}${row.name}`)

test("keeps the files whose name holds the text, ignoring case, under their open folders", () => {
  expect(shown("CART")).toEqual(["docs", "  cart.md", "src", "  cart", "    cart.ts"])
})

test("folders come first at each level, and names sort as in a listing", () => {
  expect(shown("t")).toEqual([
    "docs",
    "  cart.md",
    "src",
    "  cart",
    "    cart.ts",
    "    total.ts",
    "  main.ts",
  ])
})

test("a matched row carries where the text starts and ends in its name", () => {
  const row = filterRows(paths, "tot", new Map()).find((r) => r.id === "src/cart/total.ts")
  expect(row).toMatchObject({ match: [0, 3], expanded: null })
})

test("no match gives no row", () => {
  expect(shown("zzz")).toEqual([])
})

test("rows take their git status", () => {
  const rows = filterRows(
    paths,
    "main",
    new Map([
      ["src/main.ts", "modified" as const],
      ["src", "modified" as const],
    ]),
  )
  expect(rows.map((row) => row.status)).toEqual(["modified", "modified"])
})
