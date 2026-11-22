import { expect, test } from "vitest"
import { parseDiff } from "./diff.ts"

test("skips git's headers and its no-newline note, and drops the carriage return of a CRLF line", () => {
  const output = [
    "diff --git a/a.ts b/a.ts",
    "--- a/a.ts",
    "+++ b/a.ts",
    "@@ -1 +1 @@ const a",
    "-old\r",
    "\\ No newline at end of file",
    "+new\r",
    "",
  ].join("\n")
  expect(parseDiff(output)).toEqual({
    kind: "text",
    added: 1,
    deleted: 1,
    hunks: [
      {
        header: "@@ -1 +1 @@",
        lines: [
          { kind: "deleted", text: "old", oldLine: 1, newLine: null, changed: null },
          { kind: "added", text: "new", oldLine: null, newLine: 1, changed: null },
        ],
      },
    ],
  })
})

test("a binary file's diff is binary", () => {
  expect(parseDiff("diff --git a/x b/x\nBinary files a/x and b/x differ\n")).toEqual({
    kind: "binary",
  })
})

test("pairs a run of deleted lines with the run of added lines after it, line by line", () => {
  const output = "@@ -1,2 +1,3 @@\n-let a = 1\n-let b = 2\n+let a = 10\n+let b = 20\n+let c = 3\n"
  const parsed = parseDiff(output)
  if (parsed.kind !== "text") throw new Error(parsed.kind)
  expect(parsed.hunks[0]!.lines.map((line) => line.changed)).toEqual([
    null,
    null,
    [9, 10],
    [9, 10],
    null,
  ])
})
