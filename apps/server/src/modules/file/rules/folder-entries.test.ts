import { expect, test } from "vitest"
import { sortEntries } from "./folder-entries.ts"

test("folders come first, then names in natural order, whatever their case", () => {
  const names = sortEntries([
    { name: "b.ts", kind: "file" },
    { name: "file10.ts", kind: "file" },
    { name: "README.md", kind: "file" },
    { name: "src", kind: "folder" },
    { name: "file2.ts", kind: "file" },
    { name: "Docs", kind: "folder" },
  ]).map((entry) => entry.name)
  expect(names).toEqual(["Docs", "src", "b.ts", "file2.ts", "file10.ts", "README.md"])
})
