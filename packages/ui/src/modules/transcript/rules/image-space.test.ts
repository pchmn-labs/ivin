import { expect, test } from "vitest"
import {
  deleteImagesDescription,
  deleteImagesTitle,
  olderImagesSummary,
  storedImagesSummary,
} from "./image-space.ts"

const MB = 1024 * 1024

test("the space and the delete confirmations count images and days in plain words", () => {
  expect(storedImagesSummary({ images: 0, bytes: 0 })).toBe("No image is stored.")
  expect(storedImagesSummary({ images: 1312, bytes: 0 })).toBe("1,312 images")
  expect(olderImagesSummary({ images: 0, bytes: 0 }, 1)).toBe("No image is older than 1 day.")
  expect(olderImagesSummary({ images: 1, bytes: 2.5 * MB }, 30)).toBe("1 image · 2.5 MB")
  expect(deleteImagesTitle(30, { images: 1, bytes: 0 })).toBe(
    "Delete 1 image sent more than 30 days ago?",
  )
  expect(deleteImagesTitle(null, { images: 2, bytes: 0 })).toBe("Delete all 2 images?")
  expect(deleteImagesTitle(null, { images: 1, bytes: 0 })).toBe("Delete the stored image?")
  expect(deleteImagesDescription({ images: 1, bytes: 0 })).toContain("Its message keeps its text")
  expect(deleteImagesDescription({ images: 2, bytes: 3.7 * MB })).toMatch(/^This frees 3\.7 MB\./)
})
