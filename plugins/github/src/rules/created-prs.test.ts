import { expect, test } from "vitest"
import { createdPrUrls, createsPullRequest } from "./created-prs.ts"

test("a shell command that creates a PR is found anywhere in the input's strings", () => {
  expect(createsPullRequest("Bash", { command: 'gh pr create --title "x" --body "y"' })).toBe(true)
  expect(
    createsPullRequest("shell", { argv: ["bash", "-lc", "git push && gh pr create --fill"] }),
  ).toBe(true)
  expect(createsPullRequest("x", { nested: { command: "cd /a; gh pr create" } })).toBe(true)
})

test("an MCP tool is recognised by its name's suffix only", () => {
  expect(createsPullRequest("mcp__github__create_pull_request", {})).toBe(true)
  expect(createsPullRequest("mcp__github__get_pull_request", {})).toBe(false)
})

test("reading a PR is not creating one", () => {
  expect(createsPullRequest("Bash", { command: "gh pr view 12 --json state" })).toBe(false)
  expect(createsPullRequest("Bash", { command: "gh pr list --head x" })).toBe(false)
  expect(createsPullRequest("Bash", { command: "echo gh-pr-create" })).toBe(false)
  expect(createsPullRequest("Bash", null)).toBe(false)
})

test("the created PR is the URL gh prints, among other lines", () => {
  expect(createdPrUrls("Creating pull request...\nhttps://github.com/o/r/pull/5\n")).toEqual([
    "https://github.com/o/r/pull/5",
  ])
})
