import { expect, test } from "vitest"
import { inactiveSessions } from "./inactive-sessions.ts"

test("the sessions with no tab are inactive, in the order they are given", () => {
  const sessions = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]
  const tabs = [{ sessionId: "c" }, { sessionId: "a" }]

  expect(inactiveSessions(sessions, tabs).map((s) => s.id)).toEqual(["b", "d"])
  expect(inactiveSessions(sessions, [])).toEqual(sessions)
  expect(inactiveSessions([], tabs)).toEqual([])
})
