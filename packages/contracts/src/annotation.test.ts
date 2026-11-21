import { Schema } from "effect"
import { expect, test } from "vitest"
import { forgeLinkOf, forgeUrlOf, IssueAnnotationData, PrAnnotationData } from "./annotation.ts"

test("a GitHub pull request URL is kept as it is", () => {
  expect(forgeUrlOf("pr", "https://github.com/o/r/pull/1")).toBe("https://github.com/o/r/pull/1")
})

test("a trailing path, slash, query or fragment is dropped from the URL", () => {
  const url = "https://github.com/o/r/pull/12"
  expect(forgeUrlOf("pr", `${url}/files`)).toBe(url)
  expect(forgeUrlOf("pr", `${url}/`)).toBe(url)
  expect(forgeUrlOf("pr", `${url}?w=1`)).toBe(url)
  expect(forgeUrlOf("pr", `${url}/commits/abc?w=1#diff`)).toBe(url)
  expect(forgeUrlOf("issue", "https://github.com/o/r/issues/4#issuecomment-1")).toBe(
    "https://github.com/o/r/issues/4",
  )
})

test("a GitLab merge request URL is accepted, on gitlab.com or a self-hosted domain, in a subgroup", () => {
  expect(forgeUrlOf("pr", "https://gitlab.com/g/p/-/merge_requests/3")).toBe(
    "https://gitlab.com/g/p/-/merge_requests/3",
  )
  expect(forgeUrlOf("pr", "https://git.example.org/g/sub/p/-/merge_requests/3/diffs?view=x")).toBe(
    "https://git.example.org/g/sub/p/-/merge_requests/3",
  )
})

test("GitHub and GitLab issue URLs are accepted", () => {
  expect(forgeUrlOf("issue", "https://github.com/o/r/issues/7")).toBe(
    "https://github.com/o/r/issues/7",
  )
  expect(forgeUrlOf("issue", "https://git.example.org/g/sub/p/-/issues/7/designs")).toBe(
    "https://git.example.org/g/sub/p/-/issues/7",
  )
})

test("the host and the path are lowercased", () => {
  expect(forgeUrlOf("pr", "https://GitHub.com/O/Repo/pull/1")).toBe(
    "https://github.com/o/repo/pull/1",
  )
})

test("URLs that are not a pull request are rejected", () => {
  for (const url of [
    "not a url",
    "github.com/o/r/pull/1",
    "ftp://github.com/o/r/pull/1",
    "https://github.com/o/r",
    "https://github.com/o/r/issues/1",
    "https://github.com/o/r/pulls",
    "https://github.com/o/r/pull/",
    "https://github.com/o/r/pull/abc",
    "https://github.com/o/r/pull/0",
    "https://github.com/o/r/pull/01",
    "https://github.com/r/pull/1",
    "https://github.com/a/o/r/pull/1",
    "https://gitlab.com/g/p/merge_requests/3",
    "https://gitlab.com/-/merge_requests/3",
    "https://gitlab.com/g/p/-/issues/3",
    "https://gitlab.com/g/-/-/merge_requests/3",
    "https://github.com/-/r/pull/1",
  ]) {
    expect(forgeUrlOf("pr", url), url).toBeNull()
  }
})

test("URLs that are not an issue are rejected", () => {
  for (const url of [
    "https://github.com/o/r/pull/1",
    "https://github.com/o/r/issues",
    "https://github.com/o/r/issues/0",
    "https://github.com/r/issues/1",
    "https://gitlab.com/g/p/-/merge_requests/3",
  ]) {
    expect(forgeUrlOf("issue", url), url).toBeNull()
  }
})

test("a forge link says from its URL whether it is a pull request or an issue", () => {
  expect(forgeLinkOf("https://github.com/o/r/pull/1/files")).toEqual({
    kind: "pr",
    url: "https://github.com/o/r/pull/1",
  })
  expect(forgeLinkOf("https://gitlab.com/g/p/-/issues/2")).toEqual({
    kind: "issue",
    url: "https://gitlab.com/g/p/-/issues/2",
  })
  expect(forgeLinkOf("https://github.com/o/r")).toBeNull()
})

test("pr data needs its URL in the normalised form and one of the three relations", () => {
  const is = Schema.is(PrAnnotationData)
  expect(is({ url: "https://github.com/o/r/pull/1", relation: "referenced" })).toBe(true)
  expect(
    is({
      url: "https://github.com/o/r/pull/1",
      relation: "created",
      title: "Fix",
      state: "merged",
      checks: "passing",
    }),
  ).toBe(true)
  expect(is({ url: "https://github.com/o/r/pull/1/files", relation: "created" })).toBe(false)
  expect(is({ url: "https://x/pull/1", relation: "created" })).toBe(false)
  expect(is({ url: "https://github.com/o/r/pull/1", relation: "resolved" })).toBe(false)
  expect(is({ url: "https://github.com/o/r/pull/1", relation: "created", state: "gone" })).toBe(
    false,
  )
})

test("issue data needs a normalised issue URL and one of its three relations", () => {
  const is = Schema.is(IssueAnnotationData)
  expect(is({ url: "https://github.com/o/r/issues/1", relation: "resolved" })).toBe(true)
  expect(is({ url: "https://github.com/o/r/issues/1/", relation: "resolved" })).toBe(false)
  expect(is({ url: "https://github.com/o/r/pull/1", relation: "resolved" })).toBe(false)
  expect(is({ url: "https://github.com/o/r/issues/1", relation: "reviewed" })).toBe(false)
})
