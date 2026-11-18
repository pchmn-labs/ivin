import { expect, test } from "vitest"
import type { SessionStatus } from "@ivin/contracts/session"
import { groupSessions } from "./group-sessions.ts"

const session = (id: string, status: SessionStatus) => ({ id, status })

test("sessions waiting on the user come first, apart from the others", () => {
  const { needsYou, others } = groupSessions([
    session("a", "idle"),
    session("b", "waiting"),
    session("c", "working"),
    session("d", "failed"),
    session("e", "waiting"),
  ])
  expect(needsYou.map((s) => s.id)).toEqual(["b", "e"])
  expect(others.map((s) => s.id)).toEqual(["a", "c", "d"])
})

test("no session gives two empty groups", () => {
  expect(groupSessions([])).toEqual({ needsYou: [], others: [] })
})
