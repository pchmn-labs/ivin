import { expect, test } from "vitest"
import { gitMarks } from "./git-marks.ts"

test("a file keeps its status, and each folder above it takes one", () => {
  const marks = gitMarks([
    { path: "src/lib/cart.ts", status: "added" },
    { path: "README.md", status: "modified" },
  ])
  expect(Object.fromEntries(marks)).toEqual({
    "src/lib/cart.ts": "added",
    "src/lib": "added",
    src: "added",
    "README.md": "modified",
  })
})

test("a folder shows its most pressing status: conflicted, then modified, then untracked, then added", () => {
  const folderOf = (
    ...statuses: Array<"modified" | "added" | "untracked" | "deleted" | "conflicted">
  ) => gitMarks(statuses.map((status, i) => ({ path: `src/f${i}`, status }))).get("src")
  expect(folderOf("added", "untracked")).toBe("untracked")
  expect(folderOf("untracked", "modified", "added")).toBe("modified")
  expect(folderOf("modified", "conflicted")).toBe("conflicted")
})

test("a deleted file makes its folder modified", () => {
  expect(gitMarks([{ path: "docs/old.md", status: "deleted" }]).get("docs")).toBe("modified")
})
