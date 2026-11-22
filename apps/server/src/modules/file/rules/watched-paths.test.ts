import { expect, test } from "vitest"
import { ancestorsOf, isGitStateChange, isUnderGit } from "./watched-paths.ts"

test("only the git folder and what is under it are under git", () => {
  expect(isUnderGit(".git")).toBe(true)
  expect(isUnderGit(".git/objects/ab/cd")).toBe(true)
  expect(isUnderGit(".github/workflows/ci.yml")).toBe(false)
  expect(isUnderGit("src/.git/config")).toBe(false)
})

test("a change to the index or to HEAD means git's state changed", () => {
  expect(isGitStateChange(".git/index")).toBe(true)
  expect(isGitStateChange(".git/HEAD")).toBe(true)
  expect(isGitStateChange(".git/index.lock")).toBe(false)
  expect(isGitStateChange(".git/refs/heads/main")).toBe(false)
  expect(isGitStateChange("src/.git/index")).toBe(false)
})

test("a path comes with its folders, outermost first", () => {
  expect(ancestorsOf("a/b/c.ts")).toEqual(["a", "a/b", "a/b/c.ts"])
  expect(ancestorsOf("c.ts")).toEqual(["c.ts"])
})
