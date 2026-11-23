import type { FileListing } from "@ivin/plugin-api/ui"
import { expect, test } from "vitest"
import { keepListing } from "./keep-listing.ts"

const listed = (paths: string[], truncated = false): FileListing => ({
  kind: "listed",
  paths,
  truncated,
})

test("a listing that says the same keeps the one shown", () => {
  const shown = listed(["a.ts", "b.ts"])
  expect(keepListing(shown, listed(["a.ts", "b.ts"]))).toBe(shown)
  const deleted: FileListing = { kind: "deleted" }
  expect(keepListing(deleted, { kind: "deleted" })).toBe(deleted)
})

test("a listing that differs replaces the one shown", () => {
  const shown = listed(["a.ts", "b.ts"])
  const added = listed(["a.ts", "b.ts", "c.ts"])
  expect(keepListing(shown, added)).toBe(added)
  const renamed = listed(["a.ts", "c.ts"])
  expect(keepListing(shown, renamed)).toBe(renamed)
  const cut = listed(["a.ts", "b.ts"], true)
  expect(keepListing(shown, cut)).toBe(cut)
  expect(keepListing(null, shown)).toBe(shown)
  const failed: FileListing = { kind: "failed", failure: { text: "x", retryable: true } }
  expect(keepListing(shown, failed)).toBe(failed)
})
