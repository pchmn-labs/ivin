import { expect, test } from "vitest"
import { inactiveSessions } from "./inactive-sessions.ts"

test("the project's sessions with no tab are inactive, in the order they are given", () => {
  const sessions = ["a", "b", "c", "d"].map((id) => ({ id, projectPath: "/p" }))
  const tabs = [{ sessionId: "c" }, { sessionId: "a" }]

  expect(inactiveSessions(sessions, tabs, "/p").map((s) => s.id)).toEqual(["b", "d"])
  expect(inactiveSessions(sessions, [], "/p")).toEqual(sessions)
  expect(inactiveSessions([], tabs, "/p")).toEqual([])
})

test("another project's sessions are never inactive here", () => {
  const sessions = [
    { id: "mine", projectPath: "/p" },
    { id: "theirs", projectPath: "/other" },
  ]

  expect(inactiveSessions(sessions, [], "/p").map((s) => s.id)).toEqual(["mine"])
  expect(inactiveSessions(sessions, [], null)).toEqual([])
})
