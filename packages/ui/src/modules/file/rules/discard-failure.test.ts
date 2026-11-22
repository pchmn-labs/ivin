import { GitFailed } from "@ivin/contracts/file"
import { expect, test } from "vitest"
import { discardFailure } from "./discard-failure.ts"

test("a git failure names the file and keeps git's message", () => {
  const error = new GitFailed({
    sessionId: "s",
    gitMessage: "fatal: Unable to create 'index.lock'",
  })
  expect(discardFailure(error, "src/a.ts")).toEqual({
    text: "Git could not discard the changes to a.ts. Fix what it reports, then discard again.",
    retryable: true,
    gitMessage: "fatal: Unable to create 'index.lock'",
  })
})

test("discarding them all names no file", () => {
  const error = new GitFailed({ sessionId: "s", gitMessage: "fatal: index.lock" })
  expect(discardFailure(error, null).text).toBe(
    "Git could not discard the uncommitted changes. Fix what it reports, then discard again.",
  )
})

test("a session that no longer exists cannot be retried", () => {
  expect(discardFailure({ _tag: "SessionNotFound" }, "a.ts")).toEqual({
    text: "This session no longer exists, so its changes cannot be discarded.",
    retryable: false,
    gitMessage: null,
  })
})
