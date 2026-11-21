import type { FolderEntry } from "@ivin/plugin-api/ui"
import { expect, test } from "vitest"
import { treeRows } from "./tree-rows.ts"

const folder = (...names: string[]): ReadonlyArray<FolderEntry> =>
  names.map((name) =>
    name.endsWith("/") ? { name: name.slice(0, -1), kind: "folder" } : { name, kind: "file" },
  )

const listed = new Map([
  ["", folder("src/", "docs/", "README.md")],
  ["src", folder("lib/", "main.ts")],
  ["src/lib", folder("cart.ts")],
])

const shown = (open: ReadonlyArray<string>) =>
  treeRows(listed, new Set(open)).map((row) => `${"  ".repeat(row.depth)}${row.id}`)

test("only open folders show their children, nested under them", () => {
  expect(shown([])).toEqual(["src", "docs", "README.md"])
  expect(shown(["src", "src/lib"])).toEqual([
    "src",
    "  src/lib",
    "    src/lib/cart.ts",
    "  src/main.ts",
    "docs",
    "README.md",
  ])
})

test("an open folder inside a closed one stays hidden", () => {
  expect(shown(["src/lib"])).toEqual(["src", "docs", "README.md"])
})

test("an open folder not listed yet shows open, with no children", () => {
  const rows = treeRows(listed, new Set(["docs"]))
  expect(rows.find((row) => row.id === "docs")).toMatchObject({ expanded: true })
  expect(rows.map((row) => row.id)).toEqual(["src", "docs", "README.md"])
})

test("files have nothing to open", () => {
  expect(treeRows(listed, new Set()).find((row) => row.id === "README.md")?.expanded).toBeNull()
})
