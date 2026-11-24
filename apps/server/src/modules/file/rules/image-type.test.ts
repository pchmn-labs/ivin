import { expect, test } from "vitest"
import { imageMimeType } from "./image-type.ts"

test("a raster image extension gives its MIME type, in any case", () => {
  expect(imageMimeType("a/shot.png")).toBe("image/png")
  expect(imageMimeType("/x/PHOTO.JPG")).toBe("image/jpeg")
  expect(imageMimeType("b.jpeg")).toBe("image/jpeg")
  expect(imageMimeType("c.gif")).toBe("image/gif")
  expect(imageMimeType("d.webp")).toBe("image/webp")
  expect(imageMimeType("e.avif")).toBe("image/avif")
  expect(imageMimeType("f.bmp")).toBe("image/bmp")
  expect(imageMimeType("g.ico")).toBe("image/x-icon")
})

test("svg, other files and a name that is only an extension are not raster images", () => {
  expect(imageMimeType("logo.svg")).toBeNull()
  expect(imageMimeType("main.ts")).toBeNull()
  expect(imageMimeType("png")).toBeNull()
  expect(imageMimeType(".png")).toBeNull()
  expect(imageMimeType("dir.png/readme")).toBeNull()
})
