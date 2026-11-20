import { expect, test } from "vitest"
import { imageFileName } from "./image-file-name.ts"

test("an image's file is named after its id, with its type's extension", () => {
  expect(imageFileName("a1", "image/png")).toBe("a1.png")
  expect(imageFileName("a1", "image/jpeg")).toBe("a1.jpg")
  expect(imageFileName("a1", "image/gif")).toBe("a1.gif")
  expect(imageFileName("a1", "image/webp")).toBe("a1.webp")
})
