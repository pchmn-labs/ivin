import { expect, test } from "vitest"
import { errorTag } from "./error-tag.ts"

test("the tag of a tagged error, and none for anything else", () => {
  expect(errorTag({ _tag: "SessionNotFound", sessionId: "s1" })).toBe("SessionNotFound")
  expect(errorTag(new Error("boom"))).toBeUndefined()
  expect(errorTag("boom")).toBeUndefined()
  expect(errorTag(null)).toBeUndefined()
})
