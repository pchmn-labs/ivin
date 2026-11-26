import { expect, test } from "vitest"
import type { PrAnnotationData } from "@ivin/plugin-api/ui"
import { errorsOf, fallbackTitle, groupPrs, pillsOf, tileOf, type Pr } from "./prs.ts"

const url = (n: number) => `https://github.com/acme/shop/pull/${n}`

const source = (id: string, data: Partial<PrAnnotationData> & { url: string }) => ({
  id,
  data: { relation: "created", ...data } as PrAnnotationData,
})

const pr = (fields: Partial<Pr> = {}): Pr => ({ url: url(1), annotationIds: ["a"], ...fields })

test("annotations of one url are one pull request, with the status of the one that has a state", () => {
  const [only, ...rest] = groupPrs([
    source("cli", { url: url(1), title: "From the CLI" }),
    source("gh", { url: url(1), relation: "branch", state: "open", checks: "passing" }),
  ])
  expect(rest).toEqual([])
  expect(only).toMatchObject({
    state: "open",
    checks: "passing",
    title: "From the CLI",
    annotationIds: ["cli", "gh"],
  })
})

test("the title of the status annotation wins over another namespace's", () => {
  const [only] = groupPrs([
    source("cli", { url: url(1), title: "Old" }),
    source("gh", { url: url(1), state: "open", title: "New" }),
  ])
  expect(only?.title).toBe("New")
})

test("pull requests are ordered open, draft, merged, closed, unknown, then by latest activity", () => {
  const ordered = groupPrs([
    source("a", { url: url(1), state: "closed" }),
    source("b", { url: url(2), state: "open", activityAt: "2026-01-01T00:00:00Z" }),
    source("c", { url: url(3) }),
    source("d", { url: url(4), state: "open", activityAt: "2026-02-01T00:00:00Z" }),
    source("e", { url: url(5), state: "merged" }),
    source("f", { url: url(6), state: "draft" }),
  ])
  expect(ordered.map((p) => p.url)).toEqual([url(4), url(2), url(6), url(5), url(1), url(3)])
})

test("the corner mark reports the worst of the open and draft pull requests", () => {
  const ready = pr({ state: "open", merge: "ready" })
  const waiting = pr({ state: "open", review: "review_required" })
  expect(tileOf([ready, pr({ state: "draft", merge: "conflict" })]).mark).toBe("cross")
  expect(tileOf([ready, pr({ state: "open", checks: "failing" })]).mark).toBe("cross")
  expect(tileOf([ready, waiting]).mark).toBe("check")
  expect(tileOf([waiting]).mark).toBe("exclamation")
  expect(tileOf([pr({ state: "open", review: "changes_requested" })]).mark).toBe("exclamation")
  expect(tileOf([pr({ state: "open", review: "approved" })]).mark).toBeUndefined()
})

test("a draft never gets a check or an exclamation, and a merged pull request no mark", () => {
  expect(tileOf([pr({ state: "draft", merge: "ready", review: "review_required" })]).mark).toBe(
    undefined,
  )
  expect(tileOf([pr({ state: "merged", merge: "conflict" })]).mark).toBeUndefined()
})

test("the second pill says why an open pull request cannot merge, or that it can", () => {
  const second = (fields: Partial<Pr>) => pillsOf(pr({ state: "open", ...fields }))[0]
  expect(second({ merge: "conflict", review: "changes_requested" })?.text).toBe("Has conflicts")
  expect(second({ review: "changes_requested", merge: "ready" })?.text).toBe("Changes requested")
  expect(second({ review: "review_required" })?.text).toBe("Review required")
  expect(second({ merge: "ready", review: "approved" })?.text).toBe("Ready to merge")
  expect(second({ merge: "blocked", review: "approved" })).toBeUndefined()
})

test("a draft has its checks pill and a conflict pill only, and a merged or closed pull request none", () => {
  expect(
    pillsOf(pr({ state: "draft", checks: "passing", merge: "conflict" })).map((p) => p.text),
  ).toEqual(["Checks passed", "Has conflicts"])
  expect(
    pillsOf(pr({ state: "draft", checks: "passing", review: "review_required" })).map(
      (p) => p.text,
    ),
  ).toEqual(["Checks passed"])
  expect(pillsOf(pr({ state: "merged", checks: "passing" }))).toEqual([])
  expect(pillsOf(pr({ state: "closed", merge: "conflict" }))).toEqual([])
})

test("an error shown by several pull requests is listed once", () => {
  expect(errorsOf([pr({ error: "gh failed" }), pr({ error: "gh failed" }), pr()])).toEqual([
    "gh failed",
  ])
})

test("a pull request with no title is named by its repository and number", () => {
  expect(fallbackTitle(url(7))).toBe("acme/shop#7")
  expect(fallbackTitle("https://example.com/x")).toBe("https://example.com/x")
})
