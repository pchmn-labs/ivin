import { expect, test } from "vitest"
import { ancestorsOf, nameOf, parentOf } from "./paths.ts"

test("a path's folder, name and the folders holding it", () => {
  expect([parentOf("src/lib/cart.ts"), parentOf("README.md")]).toEqual(["src/lib", ""])
  expect([nameOf("src/lib/cart.ts"), nameOf("README.md")]).toEqual(["cart.ts", "README.md"])
  expect(ancestorsOf("src/lib/cart.ts")).toEqual(["src", "src/lib"])
  expect(ancestorsOf("README.md")).toEqual([])
})
