import { expect, test } from "vitest"
import { parseChanges } from "./changes.ts"

test("leaves out a repository nested in the working folder, which git lists as a folder", () => {
  expect(parseChanges("", "", "notes.md\0.worktrees/docs-adr/\0")).toEqual([
    { path: "notes.md", previousPath: null, status: "untracked", added: null, deleted: null },
  ])
})
