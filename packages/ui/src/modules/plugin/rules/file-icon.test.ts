import { expect, test } from "vitest"
import { fileIconOf } from "./file-icon.ts"

const row = { name: "main.ts", folder: false, open: false }

test("the first function that returns an icon wins", () => {
  const icons = [() => null, () => "second", () => "third"]
  expect(fileIconOf(icons, row)).toBe("second")
})

test("with no function, or every function returning nothing, the row gets no icon", () => {
  expect(fileIconOf([], row)).toBeNull()
  expect(fileIconOf([() => null, () => undefined], row)).toBeNull()
})
