import type { TabSubViews } from "@ivin/contracts/tab"
import { expect, test } from "vitest"
import {
  adjacentRowTab,
  withFullWidth,
  withSessionTabSelected,
  withSubViewClosed,
  withSubViewOpen,
} from "./sub-views.ts"

const file = (path: string) => ({ kind: "file" as const, path })
const none: TabSubViews = {
  sessionId: "s",
  subViews: [],
  selected: null,
  fullWidth: false,
  sessionTabSelected: false,
}

test("opening a file adds it at the end and selects it; opening it again only selects it", () => {
  const two = withSubViewOpen(withSubViewOpen(none, file("a.ts")), file("b.ts"))
  expect(two).toEqual({ ...none, subViews: [file("a.ts"), file("b.ts")], selected: file("b.ts") })
  expect(withSubViewOpen(two, file("a.ts"))).toEqual({ ...two, selected: file("a.ts") })
})

test("closing the selected file selects the next one, else the previous one, else none", () => {
  const three = { ...none, subViews: [file("a"), file("b"), file("c")], selected: file("b") }
  expect(withSubViewClosed(three, file("b")).selected).toEqual(file("c"))
  expect(withSubViewClosed({ ...three, selected: file("c") }, file("c")).selected).toEqual(
    file("b"),
  )
  expect(withSubViewClosed({ ...three, selected: file("a") }, file("c")).selected).toEqual(
    file("a"),
  )
  const last = { ...none, subViews: [file("a")], selected: file("a") }
  expect(withSubViewClosed(last, file("a"))).toEqual(none)
})

test("closing a file that is not open changes nothing", () => {
  const one = withSubViewOpen(none, file("a"))
  expect(withSubViewClosed(one, file("z"))).toBe(one)
})

const full = { ...none, subViews: [file("a"), file("b")], selected: file("b"), fullWidth: true }

test("the Session tab is selected only in full width, and a file opened or going beside leaves it", () => {
  const onSession = withSessionTabSelected(full)
  expect(onSession.sessionTabSelected).toBe(true)
  expect(withSessionTabSelected({ ...full, fullWidth: false }).sessionTabSelected).toBe(false)
  expect(withSubViewOpen(onSession, file("a"))).toMatchObject({
    selected: file("a"),
    sessionTabSelected: false,
  })
  expect(withFullWidth(onSession, false)).toMatchObject({
    fullWidth: false,
    sessionTabSelected: false,
    selected: file("b"),
  })
})

test("the next and previous tab of the row go round, through the Session tab in full width only", () => {
  const onSession = withSessionTabSelected(full)
  expect(adjacentRowTab(onSession, 1)).toEqual(file("a"))
  expect(adjacentRowTab(onSession, -1)).toEqual(file("b"))
  expect(adjacentRowTab(full, 1)).toBe("session")
  expect(adjacentRowTab({ ...full, selected: file("a") }, -1)).toBe("session")
  expect(adjacentRowTab({ ...full, fullWidth: false }, 1)).toEqual(file("a"))
  expect(adjacentRowTab(none, 1)).toBeNull()
})
