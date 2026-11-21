import { IssueAnnotationData, PrAnnotationData } from "@ivin/contracts/annotation"
import { expect, test } from "vitest"
import { annotationKey } from "./annotation-key.ts"

const pr = { data: PrAnnotationData, key: "url" }

test("a kind with no definition has no key", () => {
  expect(annotationKey(undefined, { text: "hi" })).toEqual({ key: null })
})

test("a defined kind's key is the data's key field", () => {
  expect(annotationKey(pr, { url: "https://github.com/o/r/pull/1", relation: "created" })).toEqual({
    key: "https://github.com/o/r/pull/1",
  })
})

test("data that does not match its kind's definition is invalid", () => {
  expect(annotationKey(pr, { url: "https://github.com/o/r/pull/1" })).toBe("invalid")
  expect(annotationKey(pr, "https://github.com/o/r/pull/1")).toBe("invalid")
})

test("an issue is keyed on its url, and a pr accepts the reviewed relation", () => {
  const issue = { data: IssueAnnotationData, key: "url" }
  expect(
    annotationKey(issue, { url: "https://github.com/o/r/issues/1", relation: "resolved" }),
  ).toEqual({
    key: "https://github.com/o/r/issues/1",
  })
  expect(
    annotationKey(issue, { url: "https://github.com/o/r/issues/1", relation: "reviewed" }),
  ).toBe("invalid")
  expect(annotationKey(pr, { url: "https://github.com/o/r/pull/1", relation: "reviewed" })).toEqual(
    {
      key: "https://github.com/o/r/pull/1",
    },
  )
})
