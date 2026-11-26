import { expect, test } from "vitest"
import { classifyGhFailure, failureMessage } from "./gh-failure.ts"

const message = (failure: Parameters<typeof classifyGhFailure>[0]) =>
  failureMessage(classifyGhFailure(failure))

test("each failure of gh reads as one plain sentence", () => {
  expect(message({ rejected: "spawn gh ENOENT" })).toBe(
    "gh is not installed, so the pull request's status cannot be read.",
  )
  expect(message({ stderr: "To get started with GitHub CLI, please run:  gh auth login" })).toBe(
    "gh is not logged in. Run gh auth login.",
  )
  expect(message({ stderr: "GraphQL: API rate limit already exceeded for user ID 1." })).toBe(
    "GitHub's rate limit is reached. The status is read again at the next check.",
  )
  expect(
    message({ stderr: "error connecting to api.github.com\ncheck your internet connection" }),
  ).toBe("GitHub could not be reached. The status is read again at the next check.")
  expect(message({ rejected: "Command timed out after 30000ms" })).toBe(
    "GitHub could not be reached. The status is read again at the next check.",
  )
  expect(message({ stderr: "\nsomething odd happened\nmore" })).toBe(
    "gh failed: something odd happened",
  )
})

test("a folder without a GitHub remote and an unknown number are told apart", () => {
  expect(
    classifyGhFailure({
      stderr:
        "none of the git remotes configured for this repository point to a known GitHub host.",
    }).kind,
  ).toBe("no-repo")
  expect(classifyGhFailure({ stderr: "gh: Not Found (HTTP 404)" }).kind).toBe("not-found")
})
