import { Schema } from "effect"
import { expect, test } from "vitest"
import { PrAnnotationData, pullRequestUrlOf } from "./annotation.ts"

test("a GitHub pull request URL is kept as it is", () => {
  expect(pullRequestUrlOf("https://github.com/o/r/pull/1")).toBe("https://github.com/o/r/pull/1")
})

test("a trailing path, slash, query or fragment is dropped from the URL", () => {
  const url = "https://github.com/o/r/pull/12"
  expect(pullRequestUrlOf(`${url}/files`)).toBe(url)
  expect(pullRequestUrlOf(`${url}/`)).toBe(url)
  expect(pullRequestUrlOf(`${url}?w=1`)).toBe(url)
  expect(pullRequestUrlOf(`${url}/commits/abc?w=1#diff`)).toBe(url)
})

test("a GitLab merge request URL is accepted, on gitlab.com or a self-hosted domain, in a subgroup", () => {
  expect(pullRequestUrlOf("https://gitlab.com/g/p/-/merge_requests/3")).toBe(
    "https://gitlab.com/g/p/-/merge_requests/3",
  )
  expect(pullRequestUrlOf("https://git.example.org/g/sub/p/-/merge_requests/3/diffs?view=x")).toBe(
    "https://git.example.org/g/sub/p/-/merge_requests/3",
  )
})

test("the host and the path are lowercased", () => {
  expect(pullRequestUrlOf("https://GitHub.com/O/Repo/pull/1")).toBe(
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
    expect(pullRequestUrlOf(url), url).toBeNull()
  }
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
