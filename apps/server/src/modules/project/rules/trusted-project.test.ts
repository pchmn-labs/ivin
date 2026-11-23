import { expect, test } from "vitest"
import { isInTrustedProject } from "./trusted-project.ts"

const trusted = ["/Users/u/Dev/ivin"]

test("the project folder itself is trusted", () => {
  expect(isInTrustedProject(trusted, { folder: "/Users/u/Dev/ivin", checkout: null })).toBe(true)
})

test("a folder inside the project, its worktrees under .worktrees/ included, is trusted", () => {
  expect(
    isInTrustedProject(trusted, {
      folder: "/Users/u/Dev/ivin/.worktrees/feat-x",
      checkout: "/Users/u/Dev/ivin",
    }),
  ).toBe(true)
})

test("a worktree made outside the project is trusted through its checkout", () => {
  expect(
    isInTrustedProject(trusted, { folder: "/tmp/ivin-feat", checkout: "/Users/u/Dev/ivin" }),
  ).toBe(true)
})

test("a folder whose name only starts like a trusted one is not trusted", () => {
  expect(isInTrustedProject(trusted, { folder: "/Users/u/Dev/ivin-copy", checkout: null })).toBe(
    false,
  )
})

test("a parent of a trusted project is not trusted", () => {
  expect(isInTrustedProject(trusted, { folder: "/Users/u/Dev", checkout: null })).toBe(false)
})

test("nothing is trusted before the user trusts a project", () => {
  expect(isInTrustedProject([], { folder: "/Users/u/Dev/ivin", checkout: null })).toBe(false)
})
