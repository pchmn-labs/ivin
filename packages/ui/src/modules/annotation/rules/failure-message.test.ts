import { expect, test } from "vitest"
import { removeAnnotationFailure } from "./failure-message.ts"

test("an annotation that is already gone is not a failure", () => {
  expect(removeAnnotationFailure({ _tag: "AnnotationNotFound", id: "a1" })).toBeUndefined()
})

test("any other error can be retried", () => {
  expect(removeAnnotationFailure(new Error("socket closed"))?.retryable).toBe(true)
})
