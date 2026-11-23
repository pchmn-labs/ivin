import { expect, test } from "vitest"
import { printResultOf } from "./print-result.ts"

test("a successful print run gives the model's reply", () => {
  const stdout = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: '{"title": "Tab drag"}',
    session_id: "s",
  })

  expect(printResultOf(stdout)).toEqual({ ok: true, text: '{"title": "Tab drag"}' })
})

test("a failed print run, or output that is no result, gives a failure", () => {
  const failed = JSON.stringify({ type: "result", is_error: true, result: "Not logged in" })

  expect(printResultOf(failed)).toEqual({ ok: false, message: "Not logged in" })
  expect(printResultOf("Error: unknown option")).toEqual({
    ok: false,
    message: "Claude Code printed no result: Error: unknown option",
  })
})
