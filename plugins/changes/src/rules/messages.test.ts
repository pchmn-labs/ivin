import { expect, test } from "vitest"
import { nothingChangedMessage } from "./messages.ts"

const listed = (count: number) =>
  ({ kind: "listed", base: "origin/main", changes: Array.from({ length: count }) }) as never

test("one sentence covers both groups only when neither has a change", () => {
  expect(nothingChangedMessage(0, listed(0))).toBe(
    "No changes since origin/main. What the agent changes shows up here.",
  )
  expect(nothingChangedMessage(1, listed(0))).toBeNull()
  expect(nothingChangedMessage(0, listed(2))).toBeNull()
  expect(nothingChangedMessage(0, { kind: "no_origin" })).toBeNull()
})
