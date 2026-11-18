import { expect, test } from "vitest"
import { elapsed, workingSessions } from "./working-sessions.ts"

const session = (
  id: string,
  projectPath: string,
  status: "working" | "waiting" | "idle" | "failed",
  since: number,
) => ({ id, projectPath, status, statusChangedAt: { epochMilliseconds: since } })

const projects = [{ path: "/a" }, { path: "/b" }]
const ids = (sessions: ReadonlyArray<{ readonly id: string }>) => sessions.map((s) => s.id)

test("waiting sessions need you, working ones run, and the others are left out", () => {
  const groups = workingSessions(
    [
      session("waits", "/a", "waiting", 1),
      session("works", "/a", "working", 1),
      session("idle", "/a", "idle", 1),
      session("failed", "/a", "failed", 1),
    ],
    projects,
    null,
  )

  expect(ids(groups.needsYou)).toEqual(["waits"])
  expect(ids(groups.running)).toEqual(["works"])
})

test("each group goes project by project in their order, longest in its status first", () => {
  const groups = workingSessions(
    [
      session("b-new", "/b", "working", 30),
      session("a-new", "/a", "working", 20),
      session("b-old", "/b", "working", 10),
      session("a-old", "/a", "working", 15),
      session("b-waits", "/b", "waiting", 5),
      session("a-waits", "/a", "waiting", 50),
    ],
    projects,
    null,
  )

  expect(ids(groups.running)).toEqual(["a-old", "a-new", "b-old", "b-new"])
  expect(ids(groups.needsYou)).toEqual(["a-waits", "b-waits"])
})

test("the session on screen and the sessions of closed projects are left out", () => {
  const groups = workingSessions(
    [
      session("on-screen", "/a", "waiting", 1),
      session("other-tab", "/a", "waiting", 2),
      session("closed-project", "/gone", "working", 1),
    ],
    projects,
    "on-screen",
  )

  expect(ids(groups.needsYou)).toEqual(["other-tab"])
  expect(groups.running).toEqual([])
})

test("the elapsed time reads in the largest whole unit", () => {
  const minute = 60_000
  expect(elapsed(0, 59_999)).toBe("<1 min")
  expect(elapsed(0, minute)).toBe("1 min")
  expect(elapsed(0, 59 * minute)).toBe("59 min")
  expect(elapsed(0, 60 * minute)).toBe("1 h")
  expect(elapsed(0, 48 * 60 * minute)).toBe("2 d")
  expect(elapsed(10, 0)).toBe("<1 min")
})
