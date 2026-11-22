import type { FolderEntry } from "@ivin/plugin-api/ui"
import { expect, test } from "vitest"
import { treeRows } from "./tree-rows.ts"

// A trailing `/` makes a folder, a leading `!` an entry git ignores.
const folder = (...names: string[]): ReadonlyArray<FolderEntry> =>
  names.map((raw) => {
    const ignored = raw.startsWith("!")
    const name = ignored ? raw.slice(1) : raw
    return name.endsWith("/")
      ? { name: name.slice(0, -1), kind: "folder", ignored }
      : { name, kind: "file", ignored }
  })

const listed = new Map([
  ["", folder("src/", "docs/", "!dist/", "README.md", "!.env")],
  ["src", folder("lib/", "main.ts")],
  ["src/lib", folder("cart.ts")],
  ["dist", folder("!main.js")],
])

const NONE = { showIgnored: false, statuses: new Map() }

const shown = (open: ReadonlyArray<string>, options = NONE) =>
  treeRows(listed, new Set(open), options).map((row) => `${"  ".repeat(row.depth)}${row.id}`)

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
  const rows = treeRows(listed, new Set(["docs"]), NONE)
  expect(rows.find((row) => row.id === "docs")).toMatchObject({ expanded: true })
  expect(rows.map((row) => row.id)).toEqual(["src", "docs", "README.md"])
})

test("files have nothing to open", () => {
  expect(
    treeRows(listed, new Set(), NONE).find((row) => row.id === "README.md")?.expanded,
  ).toBeNull()
})

test("what git ignores shows only when asked, marked as ignored", () => {
  const rows = treeRows(listed, new Set(["dist"]), { ...NONE, showIgnored: true })
  expect(rows.map((row) => row.id)).toEqual([
    "src",
    "docs",
    "dist",
    "dist/main.js",
    "README.md",
    ".env",
  ])
  expect(rows.filter((row) => row.status === "ignored").map((row) => row.id)).toEqual([
    "dist",
    "dist/main.js",
    ".env",
  ])
})

test("a row takes its git status", () => {
  const statuses = new Map([
    ["src", "modified" as const],
    ["README.md", "untracked" as const],
  ])
  const rows = treeRows(listed, new Set(), { showIgnored: false, statuses })
  expect(rows.map((row) => [row.id, row.status])).toEqual([
    ["src", "modified"],
    ["docs", undefined],
    ["README.md", "untracked"],
  ])
})
