import { PrAnnotationData } from "@ivin/contracts/annotation"
import { expect, test } from "vitest"
import { annotationKey } from "./annotation-key.ts"

const pr = { data: PrAnnotationData, key: "url" }

test("a kind with no definition has no key", () => {
  expect(annotationKey(undefined, { text: "hi" })).toEqual({ key: null })
})

test("a defined kind's key is the data's key field", () => {
  expect(annotationKey(pr, { url: "https://x/pull/1", relation: "created" })).toEqual({
    key: "https://x/pull/1",
  })
})

test("data that does not match its kind's definition is invalid", () => {
  expect(annotationKey(pr, { url: "https://x/pull/1" })).toBe("invalid")
  expect(annotationKey(pr, "https://x/pull/1")).toBe("invalid")
})
