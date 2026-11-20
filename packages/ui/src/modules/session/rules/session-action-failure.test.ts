import { SessionNotFound } from "@ivin/contracts/session"
import { expect, test } from "vitest"
import { sessionActionFailure } from "./session-action-failure.ts"

test("each action names what did not happen", () => {
  const error = new Error("database is locked")
  expect(sessionActionFailure("archive", error)).toBe("The session was not archived.")
  expect(sessionActionFailure("restore", error)).toBe("The session was not restored.")
  expect(sessionActionFailure("delete", error)).toBe("The session was not deleted.")
})

test("a session the server no longer has is said so, whatever the action", () => {
  const error = new SessionNotFound({ sessionId: "s1" })
  expect(sessionActionFailure("archive", error)).toBe("This session no longer exists.")
  expect(sessionActionFailure("delete", error)).toBe("This session no longer exists.")
})
