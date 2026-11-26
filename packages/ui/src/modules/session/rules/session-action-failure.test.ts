import { SessionNotFound } from "@ivin/contracts/session"
import { expect, test } from "vitest"
import { sessionActionFailure } from "./session-action-failure.ts"

test("a session the server no longer has is said so, whatever the action", () => {
  const error = new SessionNotFound({ sessionId: "s1" })
  expect(sessionActionFailure("archive", error)).toBe("This session no longer exists.")
  expect(sessionActionFailure("delete", error)).toBe("This session no longer exists.")
})
