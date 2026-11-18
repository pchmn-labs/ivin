import { expect, test } from "vitest"
import { parseJsonc } from "./parse-jsonc.ts"

test("comments and trailing commas are dropped, but not inside strings", () => {
  const text = `{
    // line
    "a": "x // y, ]", /* block */
    "b": [1, 2,],
  }`
  expect(parseJsonc(text)).toEqual({ ok: true, value: { a: "x // y, ]", b: [1, 2] } })
})

test("an escaped quote does not end a string", () => {
  expect(parseJsonc(`["a\\"//b"]`)).toEqual({ ok: true, value: ['a"//b'] })
})

test("text that is not JSON fails", () => {
  expect(parseJsonc("[{")).toEqual({ ok: false })
  expect(parseJsonc("[1] /* open")).toEqual({ ok: false })
})
