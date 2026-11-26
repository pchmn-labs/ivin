import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { bareBranch, hasBranchPr, pickBranchPr, readRepoView } from "./branch-pr.ts"

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")

const pr = (n: number, fields: Record<string, unknown> = {}) => ({
  url: `https://github.com/o/r/pull/${n}`,
  headRepositoryOwner: { login: "o" },
  state: "OPEN",
  isDraft: false,
  title: `PR ${n}`,
  updatedAt: "2026-01-01T00:00:00Z",
  ...fields,
})

test("a recorded repo view gives the owner, the name and the default branch", () => {
  expect(readRepoView(fixture("repo-view.json"))).toEqual({
    nameWithOwner: "pchmn-labs/ivin",
    owner: "pchmn-labs",
    defaultBranch: "main",
  })
  expect(readRepoView("{}")).toBeNull()
})

test("no branch and the default branch have no PR of their own", () => {
  const repo = { nameWithOwner: "o/r", owner: "o", defaultBranch: "main" }
  expect(hasBranchPr(null, repo)).toBe(false)
  expect(hasBranchPr("main", repo)).toBe(false)
  expect(hasBranchPr("refs/heads/main", repo)).toBe(false)
  expect(hasBranchPr("feat/x", repo)).toBe(true)
  expect(bareBranch("refs/heads/feat/x")).toBe("feat/x")
})

test("a recorded PR list gives the PR with its state", () => {
  expect(pickBranchPr(fixture("pr-list.json"), "pchmn-labs")).toEqual({
    url: "https://github.com/pchmn-labs/ivin/pull/389",
    state: "merged",
    title: expect.stringContaining("page only the main agent's items"),
    activityAt: "2026-11-26T14:54:58Z",
  })
})

test("a PR from a fork with the same branch name is left out, whatever the owner's case", () => {
  const list = JSON.stringify([
    pr(1, { headRepositoryOwner: { login: "someone" } }),
    pr(2, { headRepositoryOwner: { login: "O" } }),
  ])
  expect(pickBranchPr(list, "o")?.url).toBe("https://github.com/o/r/pull/2")
  expect(
    pickBranchPr(JSON.stringify([pr(1, { headRepositoryOwner: { login: "x" } })]), "o"),
  ).toBeNull()
  expect(pickBranchPr("[]", "o")).toBeNull()
})

test("an open PR wins over a newer merged one, else the latest updated wins", () => {
  const open = pr(1, { updatedAt: "2026-01-01T00:00:00Z" })
  const merged = pr(2, { state: "MERGED", updatedAt: "2026-02-01T00:00:00Z" })
  const older = pr(3, { state: "CLOSED", updatedAt: "2025-01-01T00:00:00Z" })
  expect(pickBranchPr(JSON.stringify([merged, open]), "o")?.url).toMatch(/pull\/1$/)
  expect(pickBranchPr(JSON.stringify([older, merged]), "o")?.url).toMatch(/pull\/2$/)
  expect(pickBranchPr(JSON.stringify([pr(4, { isDraft: true })]), "o")?.state).toBe("draft")
})
