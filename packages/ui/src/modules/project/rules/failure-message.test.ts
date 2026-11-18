import { expect, test } from "vitest"
import { openProjectFailure } from "./failure-message.ts"

test("a folder that was not opened can be retried", () => {
  expect(openProjectFailure(new Error("boom"))).toEqual({
    text: "The folder was not opened.",
    retry: true,
  })
})
