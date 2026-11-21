import { expect, test } from "vitest"
import { isBinary } from "./binary-content.ts"

test("text, and an empty file, are not binary", () => {
  expect(isBinary(new TextEncoder().encode("héllo\n"))).toBe(false)
  expect(isBinary(new Uint8Array())).toBe(false)
})

test("a zero byte in the first 8000 bytes makes a file binary", () => {
  expect(isBinary(Uint8Array.from([104, 0, 105]))).toBe(true)
  const late = new Uint8Array(8001).fill(97)
  late[7999] = 0
  expect(isBinary(late)).toBe(true)
})

test("a zero byte after the first 8000 bytes is not looked at", () => {
  const late = new Uint8Array(8001).fill(97)
  late[8000] = 0
  expect(isBinary(late)).toBe(false)
})
