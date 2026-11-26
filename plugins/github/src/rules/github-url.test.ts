import { expect, test } from "vitest"
import { githubIssueUrl, githubPrUrl, githubPrUrlsIn } from "./github-url.ts"

test("a PR URL is normalised: https, lowercased owner and repo, no trailing path", () => {
  expect(githubPrUrl("https://github.com/Pchmn-Labs/Ivin/pull/12/files?x=1#y")).toBe(
    "https://github.com/pchmn-labs/ivin/pull/12",
  )
  expect(githubPrUrl("http://www.github.com/o/r/pull/3")).toBe("https://github.com/o/r/pull/3")
})

test("what is not a GitHub PR is refused", () => {
  expect(githubPrUrl("https://gitlab.com/o/r/pull/3")).toBeNull()
  expect(githubPrUrl("https://github.com/o/r/issues/3")).toBeNull()
  expect(githubPrUrl("https://github.com/o/r/pull/0")).toBeNull()
  expect(githubPrUrl("https://github.com/o/r/pull/abc")).toBeNull()
  expect(githubPrUrl("not a url")).toBeNull()
  expect(githubIssueUrl("https://github.com/O/r/issues/9")).toBe("https://github.com/o/r/issues/9")
})

test("PR URLs are found in a tool's output, each once", () => {
  const output = JSON.stringify({
    url: "https://github.com/o/r/pull/7",
    note: "see https://github.com/O/R/pull/7/files and https://github.com/o/r/pull/8.",
    issue: "https://github.com/o/r/issues/2",
  })
  expect(githubPrUrlsIn(output)).toEqual([
    "https://github.com/o/r/pull/7",
    "https://github.com/o/r/pull/8",
  ])
  expect(githubPrUrlsIn("https://github.com/o/r/pull/9\n")).toEqual([
    "https://github.com/o/r/pull/9",
  ])
})
