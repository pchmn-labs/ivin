import type { Change } from "@ivin/plugin-api/ui"
import { expect, test } from "vitest"
import { ALL, inRepository, repositoryChips } from "./repository-filter.ts"

const change = (path: string): Change => ({
  path,
  previousPath: null,
  status: "modified",
  added: 1,
  deleted: 0,
})

const changes = [change("api/a.ts"), change("api/b.ts"), change("web/c.ts")]

test("each repository with changes gets a chip with its count, after All", () => {
  expect(repositoryChips(["api", "web", "docs"], changes, ALL)).toEqual({
    chips: [
      { value: ALL, label: "All", count: 3 },
      { value: "api", label: "api", count: 2 },
      { value: "web", label: "web", count: 1 },
    ],
    picked: ALL,
  })
})

test("a file changed both ways counts once", () => {
  const { chips } = repositoryChips(["api", "web"], [...changes, change("api/a.ts")], ALL)
  expect(chips.map((chip) => chip.count)).toEqual([3, 2, 1])
})

test("a pick that has no change left falls back to all, and one repository needs no chips", () => {
  expect(repositoryChips(["api", "web"], changes, "docs").picked).toBe(ALL)
  expect(repositoryChips(["api", "web"], [change("api/a.ts")], "api")).toEqual({
    chips: [],
    picked: ALL,
  })
})

test("the pick keeps the changes under its repository", () => {
  expect(inRepository(changes, "web").map((c) => c.path)).toEqual(["web/c.ts"])
  expect(inRepository(changes, ALL)).toHaveLength(3)
})
