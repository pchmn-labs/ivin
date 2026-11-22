import { expect, test } from "vitest"
import { parseGitStatus } from "./git-status.ts"

const record = (...fields: string[]) => fields.join("\0") + "\0"

test("maps each pair of status letters to one status", () => {
  const output = record(
    "?? new.ts",
    " M changed.ts",
    "M  staged.ts",
    "MM both.ts",
    " T mode.ts",
    "A  added.ts",
    "AM added-then-edited.ts",
    " D gone.ts",
    "D  removed.ts",
    "AD added-then-gone.ts",
    "UU merge.ts",
    "AA both-added.ts",
    "DD both-deleted.ts",
    "DU deleted-by-us.ts",
    "UD deleted-by-them.ts",
  )
  expect(parseGitStatus(output, "")).toEqual([
    { path: "new.ts", status: "untracked" },
    { path: "changed.ts", status: "modified" },
    { path: "staged.ts", status: "modified" },
    { path: "both.ts", status: "modified" },
    { path: "mode.ts", status: "modified" },
    { path: "added.ts", status: "added" },
    { path: "added-then-edited.ts", status: "added" },
    { path: "gone.ts", status: "deleted" },
    { path: "removed.ts", status: "deleted" },
    { path: "added-then-gone.ts", status: "deleted" },
    { path: "merge.ts", status: "conflicted" },
    { path: "both-added.ts", status: "conflicted" },
    { path: "both-deleted.ts", status: "conflicted" },
    { path: "deleted-by-us.ts", status: "conflicted" },
    { path: "deleted-by-them.ts", status: "conflicted" },
  ])
})

test("a rename or a copy is an added file under its new path, and its old path is skipped", () => {
  const output = record("R  new-name.ts", "old-name.ts", "C  copy.ts", "source.ts", " M after.ts")
  expect(parseGitStatus(output, "")).toEqual([
    { path: "new-name.ts", status: "added" },
    { path: "copy.ts", status: "added" },
    { path: "after.ts", status: "modified" },
  ])
})

test("paths are made relative to the working folder, and those outside it are dropped", () => {
  const output = record(
    " M apps/web/src/a.ts",
    " M apps/web/b.ts",
    " M apps/webby/c.ts",
    " M README.md",
    "R  apps/web/new.ts",
    "README.md",
  )
  expect(parseGitStatus(output, "apps/web/")).toEqual([
    { path: "src/a.ts", status: "modified" },
    { path: "b.ts", status: "modified" },
    { path: "new.ts", status: "added" },
  ])
})

test("no output is no entry", () => {
  expect(parseGitStatus("", "")).toEqual([])
})
