import { expect, test } from "vitest"
import { byteSize } from "./byte-size.ts"

test("a size reads in the largest unit under 1024 of it", () => {
  expect(byteSize(612)).toBe("612 B")
  expect(byteSize(319_488)).toBe("312 KB")
  expect(byteSize(1.4 * 1024 * 1024)).toBe("1.4 MB")
  expect(byteSize(3 * 1024 * 1024)).toBe("3 MB")
  expect(byteSize(2.25 * 1024 ** 3)).toBe("2.3 GB")
})
