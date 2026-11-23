import { expect, test } from "vitest"
import { isNotTrusted, openProjectFailure } from "./failure-message.ts"

test("a folder that was not opened can be retried", () => {
  expect(openProjectFailure(new Error("boom"))).toEqual({
    text: "The folder was not opened.",
    retryable: true,
  })
})

test("a folder in no trusted project is told apart from other failures", () => {
  expect(isNotTrusted({ _tag: "ProjectNotTrusted", path: "/a" })).toBe(true)
  expect(isNotTrusted({ _tag: "ProjectNotOpen", path: "/a" })).toBe(false)
  expect(isNotTrusted(new Error("boom"))).toBe(false)
})
