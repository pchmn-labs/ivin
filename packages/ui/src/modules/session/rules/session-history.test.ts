import { expect, test } from "vitest"
import {
  canGoBack,
  canGoForward,
  currentOf,
  emptyHistory,
  goBack,
  goForward,
  visit,
} from "./session-history.ts"

const visited = (...ids: string[]) => ids.reduce(visit, emptyHistory)

test("visiting sessions records them in order", () => {
  const history = visited("a", "b", "c")
  expect(currentOf(history)).toBe("c")
  expect(canGoBack(history)).toBe(true)
  expect(canGoForward(history)).toBe(false)
})

test("visiting the current session again records nothing", () => {
  expect(visited("a", "a")).toEqual(visited("a"))
})

test("back and forward walk the entries and stop at the ends", () => {
  const history = visited("a", "b")
  expect(currentOf(goBack(history))).toBe("a")
  expect(goBack(goBack(history))).toEqual(goBack(history))
  expect(currentOf(goForward(goBack(history)))).toBe("b")
  expect(goForward(history)).toBe(history)
})

test("visiting after going back drops the entries ahead", () => {
  const history = visit(goBack(visited("a", "b", "c")), "d")
  expect(history.entries).toEqual(["a", "b", "d"])
  expect(canGoForward(history)).toBe(false)
})

test("an empty history has no current session and cannot move", () => {
  expect(currentOf(emptyHistory)).toBeNull()
  expect(canGoBack(emptyHistory)).toBe(false)
  expect(canGoForward(emptyHistory)).toBe(false)
})
