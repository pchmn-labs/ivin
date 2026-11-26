import { expect, test } from "vitest"
import { changedFiles, unifiedDiff, type PluginTree } from "./plugin-diff.ts"

const tree = (files: Record<string, string | null>): PluginTree =>
  new Map(Object.entries(files).map(([path, text]) => [path, { text, digest: `${path}:${text}` }]))

test("a plugin never trusted has every file added and no diff", () => {
  const disk = tree({ "b.ts": "b", "a.ts": "a" })

  expect(changedFiles(null, disk)).toEqual([
    { path: "a.ts", status: "A" },
    { path: "b.ts", status: "A" },
  ])
  expect(unifiedDiff(null, disk)).toBe("")
})

test("files are added, modified or deleted against the trusted version, sorted, unchanged ones left out", () => {
  const trusted = tree({ "keep.ts": "k", "edit.ts": "1", "gone.ts": "g" })
  const disk = tree({ "keep.ts": "k", "edit.ts": "2", "new.ts": "n" })

  expect(changedFiles(trusted, disk)).toEqual([
    { path: "edit.ts", status: "M" },
    { path: "gone.ts", status: "D" },
    { path: "new.ts", status: "A" },
  ])
})

test("the diff is unified: hunks with context, a header per file, and whole-file adds and deletes", () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`)
  const before = lines(20).join("\n") + "\n"
  const after = lines(20).with(9, "changed").join("\n") + "\n"

  const diff = unifiedDiff(
    tree({ "a.ts": before, "gone.ts": "x\n" }),
    tree({ "a.ts": after, "new.ts": "y\n" }),
  )

  expect(diff).toBe(
    [
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -7,7 +7,7 @@",
      " line 7",
      " line 8",
      " line 9",
      "-line 10",
      "+changed",
      " line 11",
      " line 12",
      " line 13",
      "--- a/gone.ts",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-x",
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,1 @@",
      "+y",
      "",
    ].join("\n"),
  )
})

test("a binary file is named in the file list but has no lines in the diff", () => {
  const trusted = tree({ "logo.png": null })
  const disk = { ...Object.fromEntries(trusted), "logo.png": { text: null, digest: "other" } }

  expect(changedFiles(trusted, new Map(Object.entries(disk)))).toEqual([
    { path: "logo.png", status: "M" },
  ])
  expect(unifiedDiff(trusted, new Map(Object.entries(disk)))).toBe("Binary file logo.png differs\n")
})
