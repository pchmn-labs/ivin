import { expect, test } from "vitest"
import { diffDocument } from "./diff-document.ts"

test("joins the hunks' lines into one text, each hunk starting at its first line", () => {
  const line = (text: string) =>
    ({ kind: "context", text, oldLine: 1, newLine: 1, changed: null }) as const
  const { text, layout } = diffDocument([
    { header: "@@ -1,2 +1,2 @@", lines: [line("a"), line("b")] },
    { header: "@@ -9 +9 @@", lines: [line("c")] },
  ])
  expect(text).toBe("a\nb\nc")
  expect(layout.hunks).toEqual([
    { start: 0, header: "@@ -1,2 +1,2 @@" },
    { start: 2, header: "@@ -9 +9 @@" },
  ])
  expect(layout.rows).toHaveLength(3)
})
