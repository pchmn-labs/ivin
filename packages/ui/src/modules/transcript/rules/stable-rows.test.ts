import { expect, test } from "vitest"
import { stableRows } from "./stable-rows.ts"
import type { TranscriptRow } from "./turns.ts"

const item = (id: string): TranscriptRow => ({ type: "item", id })
const work = (id: string, itemIds: string[]): TranscriptRow => ({
  type: "work",
  id,
  itemIds,
  turnIds: itemIds,
  answerIds: [],
})

test("the same rows keep the previous value", () => {
  const shown = { rows: [item("a"), work("w", ["b"])], prepended: 0 }

  expect(stableRows(shown, [item("a"), work("w", ["b"])])).toBe(shown)
})

test("an unchanged row keeps its object when another row changes", () => {
  const a = item("a")
  const next = stableRows({ rows: [a, work("w", ["b"])], prepended: 0 }, [
    item("a"),
    work("w", ["b", "c"]),
  ])

  expect(next.rows[0]).toBe(a)
  expect(next.rows[1]).toMatchObject({ itemIds: ["b", "c"] })
})

test("rows added above count as prepended, even when the first row changed its id", () => {
  const shown = { rows: [work("work:c1", ["c1"]), item("answer")], prepended: 2 }

  const next = stableRows(shown, [item("u0"), work("work:u0", ["c0", "c1"]), item("answer")])

  expect(next.prepended).toBe(3)
})

test("rows added at the end are not prepended", () => {
  expect(stableRows({ rows: [item("a")], prepended: 0 }, [item("a"), item("b")]).prepended).toBe(0)
})
