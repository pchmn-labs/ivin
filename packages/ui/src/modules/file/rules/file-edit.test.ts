import { expect, test } from "vitest"
import {
  noEdit,
  shownText,
  withChangedOnDisk,
  withRead,
  withSaveFailed,
  withSaved,
  withSaving,
  withTyped,
} from "./file-edit.ts"

const read = (text: string, version = text) => ({ text, version })

test("a read becomes the base of a file with no edits", () => {
  const edit = withRead(noEdit, read("a"))
  expect(edit.base).toEqual(read("a"))
  expect(shownText(edit)).toBe("a")
})

test("typing makes a draft, and typing back to the base drops it", () => {
  const typed = withTyped(withRead(noEdit, read("a")), "ab")
  expect(typed.draft).toBe("ab")
  expect(shownText(typed)).toBe("ab")
  expect(withTyped(typed, "a").draft).toBeNull()
})

test("a new read under a draft marks the file changed on disk and keeps the draft's base", () => {
  const typed = withTyped(withRead(noEdit, read("a", "v1")), "ab")
  const after = withRead(typed, read("agent", "v2"))
  expect(after).toMatchObject({ draft: "ab", base: read("a", "v1"), changedOnDisk: true })
  expect(withRead(typed, read("a", "v1")).changedOnDisk).toBe(false)
})

test("a save makes the saved text the base, and keeps what was typed while it ran", () => {
  const saving = withSaving(withTyped(withRead(noEdit, read("a", "v1")), "ab"))
  expect(saving.saving).toBe(true)
  expect(withSaved(saving, "ab", "v2")).toEqual({ ...noEdit, base: read("ab", "v2") })
  const typedMeanwhile = withTyped(saving, "abc")
  expect(withSaved(typedMeanwhile, "ab", "v2")).toMatchObject({
    draft: "abc",
    base: read("ab", "v2"),
    saving: false,
  })
})

test("a failed save keeps the draft and its message until the next save", () => {
  const failure = { text: "No.", retryable: true }
  const failed = withSaveFailed(withSaving(withTyped(withRead(noEdit, read("a")), "ab")), failure)
  expect(failed).toMatchObject({ draft: "ab", failure, saving: false })
  expect(withTyped(failed, "abc").failure).toBe(failure)
  expect(withSaving(failed).failure).toBeNull()
})

test("a save refused as changed on disk keeps the draft", () => {
  const refused = withChangedOnDisk(withSaving(withTyped(withRead(noEdit, read("a")), "ab")))
  expect(refused).toMatchObject({ draft: "ab", changedOnDisk: true, saving: false })
})
