import { SessionNotFound } from "@ivin/contracts/session"
import { expect, test } from "vitest"
import { openFileFailure } from "./sub-view-failure.ts"

test("a file that could not be opened names itself, with a retry unless its session is gone", () => {
  expect(openFileFailure(new Error("lost"), "src/a.ts")).toEqual({
    text: "a.ts could not be opened. Retry.",
    retryable: true,
  })
  expect(openFileFailure(new SessionNotFound({ sessionId: "s" }), "src/a.ts")).toEqual({
    text: "This session no longer exists, so its files cannot be opened.",
    retryable: false,
  })
})
