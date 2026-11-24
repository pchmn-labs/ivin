import type { CommittedChangeListing } from "@ivin/plugin-api/ui"
import { expect, test } from "vitest"
import { emptyMessages } from "./messages.ts"

const listed = (count: number) =>
  ({ kind: "listed", base: "origin/main", changes: Array.from({ length: count }) }) as never

test("one sentence covers both groups when neither has a change", () => {
  expect(emptyMessages(0, listed(0))).toEqual({
    uncommitted: "No changes since origin/main. What the agent changes shows up here.",
    committed: null,
  })
})

test("each group says what it lacks when only one is empty, or when the commits cannot be listed", () => {
  expect(emptyMessages(0, listed(2)).uncommitted).toBe(
    "No uncommitted changes. What the agent changes shows up here.",
  )
  expect(emptyMessages(1, listed(0))).toEqual({
    uncommitted: null,
    committed: "No committed changes since origin/main.",
  })
  expect(emptyMessages(0, { kind: "no_origin" })).toEqual({
    uncommitted: "No uncommitted changes. What the agent changes shows up here.",
    committed: "This repository has no origin remote, so the branch's commits cannot be listed.",
  })
})

test("no sentence shows for an empty working folder until the commits are listed", () => {
  const loading: CommittedChangeListing = { kind: "loading" }
  expect(emptyMessages(0, loading)).toEqual({ uncommitted: null, committed: null })
})
