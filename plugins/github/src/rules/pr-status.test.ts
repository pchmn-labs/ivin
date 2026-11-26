import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { checksOf, mergeOf, pollEveryFor, readPrView } from "./pr-status.ts"

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")

const run = (status: string, conclusion: string | null) => ({
  __typename: "CheckRun",
  status,
  conclusion,
})
const context = (state: string) => ({ __typename: "StatusContext", state })

test("a recorded merged PR reads as merged, with its passing checks and no merge verdict", () => {
  const fields = readPrView(fixture("pr-view-merged.json"), "ready")
  expect(fields).toEqual({
    state: "merged",
    title: expect.stringContaining("page only the main agent's items"),
    checks: "passing",
    checkCounts: { passed: 3, failed: 0, pending: 0 },
    activityAt: "2026-11-26T14:54:58Z",
  })
})

test("the state maps from OPEN, isDraft, MERGED and CLOSED", () => {
  const state = (state: string, isDraft = false) =>
    readPrView(JSON.stringify({ state, isDraft, title: "t" }), undefined)?.state
  expect(state("OPEN")).toBe("open")
  expect(state("OPEN", true)).toBe("draft")
  expect(state("MERGED")).toBe("merged")
  expect(state("CLOSED")).toBe("closed")
  expect(readPrView("not json", undefined)).toBeNull()
  expect(readPrView(JSON.stringify({ state: "WHAT" }), undefined)).toBeNull()
})

test("checks: failing beats pending beats passing, and none is omitted", () => {
  expect(checksOf([])).toEqual({})
  expect(
    checksOf([
      run("COMPLETED", "SUCCESS"),
      run("COMPLETED", "SKIPPED"),
      run("COMPLETED", "NEUTRAL"),
    ]),
  ).toEqual({
    checks: "passing",
    checkCounts: { passed: 3, failed: 0, pending: 0 },
  })
  expect(checksOf([run("IN_PROGRESS", null), run("COMPLETED", "SUCCESS")]).checks).toBe("pending")
  expect(checksOf([run("QUEUED", null), run("COMPLETED", "TIMED_OUT")])).toEqual({
    checks: "failing",
    checkCounts: { passed: 0, failed: 1, pending: 1 },
  })
  for (const conclusion of [
    "FAILURE",
    "TIMED_OUT",
    "CANCELLED",
    "ACTION_REQUIRED",
    "STARTUP_FAILURE",
  ]) {
    expect(checksOf([run("COMPLETED", conclusion)]).checks).toBe("failing")
  }
})

test("commit statuses count like check runs", () => {
  expect(checksOf([context("PENDING")]).checks).toBe("pending")
  expect(checksOf([context("EXPECTED")]).checks).toBe("pending")
  expect(checksOf([context("ERROR")]).checks).toBe("failing")
  expect(checksOf([context("FAILURE")]).checks).toBe("failing")
  expect(checksOf([context("SUCCESS")]).checks).toBe("passing")
})

test("the review decision maps, and an empty one is omitted", () => {
  const review = (reviewDecision: string) =>
    readPrView(JSON.stringify({ state: "OPEN", reviewDecision }), undefined)?.review
  expect(review("APPROVED")).toBe("approved")
  expect(review("CHANGES_REQUESTED")).toBe("changes_requested")
  expect(review("REVIEW_REQUIRED")).toBe("review_required")
  expect(review("")).toBeUndefined()
})

test("mergeability: conflicts, readiness, blocks, and unknown keeping the last value", () => {
  expect(mergeOf("CONFLICTING", "DIRTY", "ready")).toBe("conflict")
  expect(mergeOf("MERGEABLE", "DIRTY", undefined)).toBe("conflict")
  expect(mergeOf("MERGEABLE", "CLEAN", undefined)).toBe("ready")
  expect(mergeOf("MERGEABLE", "HAS_HOOKS", undefined)).toBe("ready")
  expect(mergeOf("MERGEABLE", "UNSTABLE", undefined)).toBe("ready")
  expect(mergeOf("MERGEABLE", "BLOCKED", "ready")).toBe("blocked")
  expect(mergeOf("MERGEABLE", "BEHIND", undefined)).toBe("blocked")
  expect(mergeOf("UNKNOWN", "UNKNOWN", "conflict")).toBe("conflict")
  expect(mergeOf("UNKNOWN", "UNKNOWN", undefined)).toBeUndefined()
})

test("an open PR's merge verdict is read, with the last one kept while unknown", () => {
  const view = (mergeable: string, mergeStateStatus: string) =>
    JSON.stringify({ state: "OPEN", mergeable, mergeStateStatus })
  expect(readPrView(view("MERGEABLE", "CLEAN"), undefined)?.merge).toBe("ready")
  expect(readPrView(view("UNKNOWN", "UNKNOWN"), "blocked")?.merge).toBe("blocked")
  expect(readPrView(view("UNKNOWN", "UNKNOWN"), undefined)).not.toHaveProperty("merge")
})

test("the poll slows down to 3 minutes and speeds up to 45 seconds while checks run", () => {
  expect(pollEveryFor({ checks: "pending" })).toBe(45_000)
  expect(pollEveryFor({ checks: "passing" })).toBe(180_000)
  expect(pollEveryFor({})).toBe(180_000)
})
