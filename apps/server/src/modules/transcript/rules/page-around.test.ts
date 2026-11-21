import type { TranscriptItem } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { pageAround } from "./page-around.ts"

const items: TranscriptItem[] = Array.from({ length: 10 }, (_, i) => ({
  id: `i${i}`,
  sessionId: "s1",
  position: (i + 1) * 2,
  at: 0,
  type: "thinking",
  text: "",
}))
const ids = (page: { items: readonly TranscriptItem[] }) => page.items.map((item) => item.id)

test("a null position pages the end of the transcript", () => {
  const page = pageAround(items, null, 3, 5)

  expect(ids(page)).toEqual(["i7", "i8", "i9"])
  expect(page).toMatchObject({ hasBefore: true, hasAfter: false })
})

test("a position pages around the first item at or after it", () => {
  const page = pageAround(items, 9, 2, 2)

  expect(ids(page)).toEqual(["i2", "i3", "i4", "i5"])
  expect(page).toMatchObject({ hasBefore: true, hasAfter: true })
})

test("a small transcript comes back whole with nothing before or after", () => {
  const page = pageAround(items.slice(0, 2), null, 50, 50)

  expect(ids(page)).toEqual(["i0", "i1"])
  expect(page).toMatchObject({ hasBefore: false, hasAfter: false })
})

test("an empty transcript gives an empty page", () => {
  expect(pageAround([], null, 5, 5)).toEqual({ items: [], hasBefore: false, hasAfter: false })
})
