import { join } from "node:path"
import { expect, test } from "vitest"
import { imageFile } from "./image-protocol.ts"

const folder = "/data/images"

test("an image URL names its session's folder and its file", () => {
  expect(imageFile(folder, "ivin-image://3f2a-91/c0de-42.png")).toBe(
    join(folder, "3f2a-91", "c0de-42.png"),
  )
})

test("a URL that could leave the folder, or names no image file, gives nothing", () => {
  expect(imageFile(folder, "ivin-image://s1/..%2F..%2Fivin.db")).toBeNull()
  expect(imageFile(folder, "ivin-image://s1/../ivin.db")).toBeNull()
  expect(imageFile(folder, "ivin-image://s1/notes.txt")).toBeNull()
  expect(imageFile(folder, "ivin-image://s1/a/b.png")).toBeNull()
  expect(imageFile(folder, "not a url")).toBeNull()
})
