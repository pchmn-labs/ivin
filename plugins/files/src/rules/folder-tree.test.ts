import type { FolderEntry } from "@ivin/plugin-api/ui"
import { expect, test } from "vitest"
import {
  foldersToReload,
  listedFolders,
  withListing,
  type FolderState,
  type FolderTree,
} from "./folder-tree.ts"

const entries = (...names: string[]): ReadonlyArray<FolderEntry> =>
  names.map((name) =>
    name.endsWith("/")
      ? { name: name.slice(0, -1), kind: "folder", ignored: false }
      : { name, kind: "file", ignored: false },
  )

const listed = (...names: string[]) => ({ kind: "listed", entries: entries(...names) }) as const

const tree: FolderTree = {
  open: new Set(["src", "src/lib", "docs"]),
  folders: new Map([
    ["", listed("src/", "docs/", "README.md")],
    ["src", listed("lib/", "main.ts")],
    ["src/lib", listed("cart.ts")],
    ["docs", listed("guide.md")],
  ]),
}

test("a new listing replaces the folder's", () => {
  const next = withListing(tree, "src", listed("lib/", "total.ts"))
  expect(next.folders.get("src")).toEqual(listed("lib/", "total.ts"))
  expect(next.open).toEqual(tree.open)
})

test("a folder gone from its parent's listing is forgotten, with everything under it", () => {
  const next = withListing(tree, "", listed("docs/", "README.md"))
  expect([...next.folders.keys()]).toEqual(["", "docs"])
  expect([...next.open]).toEqual(["docs"])
})

test("a failed listing keeps the folders under it", () => {
  const failed = { kind: "failed", failure: { text: "x", retryable: true } } as const
  const next = withListing(tree, "", failed)
  expect(next.folders.get("src/lib")).toEqual(tree.folders.get("src/lib"))
})

test("the folders to list again are those holding a changed path, parents first, once each", () => {
  expect(
    foldersToReload(tree, [
      "src/lib/cart.ts",
      "src/new.ts",
      "docs/guide.md",
      "README.md",
      "dist/x.js",
    ]),
  ).toEqual(["", "docs", "src", "src/lib"])
})

test("only the folders that are listed give their entries", () => {
  const folders = new Map<string, FolderState>([
    ["", listed("a.ts")],
    ["loading", { kind: "loading" }],
  ])
  expect([...listedFolders({ open: new Set(), folders }).keys()]).toEqual([""])
})
