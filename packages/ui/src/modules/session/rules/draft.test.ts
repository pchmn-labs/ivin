import { expect, test } from "vitest"
import { type Draft, type DraftImage, draftImages, nextImageNumber } from "./draft.ts"

const image = (number: number): DraftImage => ({
  id: `i${number}`,
  number,
  mediaType: "image/png",
  base64: "iVBO",
  name: `shot-${number}.png`,
})

test("the draft sends the images its text still marks, in the text's order, once each", () => {
  const draft: Draft = {
    text: "[Image #5] then [Image #4] and [Image #5] again",
    images: [image(4), image(5), image(6)],
  }
  expect(draftImages(draft).map((i) => i.number)).toEqual([5, 4])
})

test("a new image takes the number after the session's last one and the draft's", () => {
  expect(nextImageNumber(0, { text: "", images: [] })).toBe(1)
  expect(nextImageNumber(3, { text: "", images: [image(7)] })).toBe(8)
  expect(nextImageNumber(9, { text: "", images: [image(7)] })).toBe(10)
})
