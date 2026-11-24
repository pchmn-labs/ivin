import { expect, test } from "vitest"
import { placeToRestore, type TranscriptPlace } from "./transcript-place.ts"

const place = (overrides: Partial<TranscriptPlace> = {}): TranscriptPlace => ({
  firstIndex: 1000,
  atEnd: false,
  list: { ranges: [], scrollTop: 120 },
  ...overrides,
})

test("a transcript scrolled up opens where it was", () => {
  expect(placeToRestore(place(), 1000)).toEqual(place())
})

test("a transcript left at its end opens at its new end", () => {
  expect(placeToRestore(place({ atEnd: true }), 1000)).toBeUndefined()
})

test("a place measured before older items were loaded no longer applies", () => {
  expect(placeToRestore(place(), 950)).toBeUndefined()
})

test("no place saved opens at the end", () => {
  expect(placeToRestore(null, 1000)).toBeUndefined()
})
