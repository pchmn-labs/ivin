import { expect, test } from "vitest"
import { startupNoticeOf } from "./startup-notice.ts"

test("a notice the desktop app sends is read, and anything else is no notice", () => {
  expect(startupNoticeOf({ _tag: "reloadedWithout", plugins: ["a", "b"] })).toEqual({
    _tag: "reloadedWithout",
    plugins: ["a", "b"],
  })
  expect(startupNoticeOf(null)).toBeNull()
  expect(startupNoticeOf({ _tag: "unknown" })).toBeNull()
})
