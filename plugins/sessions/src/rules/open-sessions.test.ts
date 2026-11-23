import { expect, test } from "vitest"
import { openSessions } from "./open-sessions.ts"

test("the sessions with a tab come in tab bar order", () => {
  const sessions = ["a", "b", "c"].map((id) => ({ id }))
  const tabs = [{ sessionId: "c" }, { sessionId: "a" }]

  expect(openSessions(sessions, tabs).map((s) => s.id)).toEqual(["c", "a"])
})

test("a tab whose session has not arrived yet is left out", () => {
  expect(openSessions([{ id: "a" }], [{ sessionId: "x" }, { sessionId: "a" }])).toEqual([
    { id: "a" },
  ])
})
