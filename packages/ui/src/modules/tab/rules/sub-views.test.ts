import type { TabSubViews } from "@ivin/contracts/tab"
import { expect, test } from "vitest"
import { withSubViewClosed, withSubViewOpen } from "./sub-views.ts"

const file = (path: string) => ({ kind: "file" as const, path })
const none: TabSubViews = { sessionId: "s", subViews: [], selected: null }

test("opening a file adds it at the end and selects it; opening it again only selects it", () => {
  const two = withSubViewOpen(withSubViewOpen(none, file("a.ts")), file("b.ts"))
  expect(two).toEqual({
    sessionId: "s",
    subViews: [file("a.ts"), file("b.ts")],
    selected: file("b.ts"),
  })
  expect(withSubViewOpen(two, file("a.ts"))).toEqual({ ...two, selected: file("a.ts") })
})

test("closing the selected file selects the next one, else the previous one, else none", () => {
  const three = { sessionId: "s", subViews: [file("a"), file("b"), file("c")], selected: file("b") }
  expect(withSubViewClosed(three, file("b")).selected).toEqual(file("c"))
  expect(withSubViewClosed({ ...three, selected: file("c") }, file("c")).selected).toEqual(
    file("b"),
  )
  expect(withSubViewClosed({ ...three, selected: file("a") }, file("c")).selected).toEqual(
    file("a"),
  )
  const last = { sessionId: "s", subViews: [file("a")], selected: file("a") }
  expect(withSubViewClosed(last, file("a"))).toEqual(none)
})

test("closing a file that is not open changes nothing", () => {
  const one = withSubViewOpen(none, file("a"))
  expect(withSubViewClosed(one, file("z"))).toBe(one)
})
