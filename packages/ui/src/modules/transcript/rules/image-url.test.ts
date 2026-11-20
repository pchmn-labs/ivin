import { expect, test } from "vitest"
import { imageDataUrl, storedImageUrl } from "./image-url.ts"

test("a stored image is read from its file, named after its id and type", () => {
  expect(storedImageUrl("s1", { id: "a1", mediaType: "image/jpeg" })).toBe("ivin-image://s1/a1.jpg")
  expect(storedImageUrl("s1", { id: "a1", mediaType: "image/webp" })).toBe(
    "ivin-image://s1/a1.webp",
  )
})

test("an image not stored yet is shown from its bytes", () => {
  expect(imageDataUrl({ mediaType: "image/png", base64: "iVBO" })).toBe(
    "data:image/png;base64,iVBO",
  )
})
