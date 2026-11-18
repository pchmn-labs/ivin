import { expect, test } from "vitest"
import { initials } from "./initials.ts"

test("two words give their first letters", () => {
  expect(initials("my-project")).toBe("MP")
  expect(initials("ivin app")).toBe("IA")
})

test("one word gives its first two letters", () => {
  expect(initials("ivin")).toBe("IV")
  expect(initials("x")).toBe("X")
})

test("an empty name gives a placeholder", () => {
  expect(initials("")).toBe("?")
})
