import { expect, test } from "vitest"
import type { Draft, DraftImage } from "@ivin/plugin-api/ui"
import { bytesToBase64, draftImages, nextImageNumber, withUnreadMessages } from "./draft.ts"

const fetched = (number: number, id: string) => ({ number, image: { ...image(number), id } })

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

test("unread messages join the draft with their images renumbered after the draft's and the session's", () => {
  const unread = [
    { text: "see [Image #1] and [Image #2]", images: [fetched(1, "a"), fetched(2, "b")] },
    { text: "again [Image #1]", images: [fetched(1, "c")] },
  ]
  const draft: Draft = { text: "typed [Image #4]", images: [image(4)] }

  const next = withUnreadMessages(draft, 6, unread)

  expect(next.text).toBe("typed [Image #4]\n\nsee [Image #7] and [Image #8]\n\nagain [Image #9]")
  expect(next.images.map((i) => [i.id, i.number])).toEqual([
    ["i4", 4],
    ["a", 7],
    ["b", 8],
    ["c", 9],
  ])
  expect(draftImages(next)).toHaveLength(4)
})

test("an unread message's image that no marker names, or that could not be fetched, stays consistent", () => {
  const next = withUnreadMessages({ text: "", images: [] }, 0, [
    { text: "", images: [fetched(1, "a")] },
    { text: "lost [Image #1]", images: [{ number: 1, image: null }] },
  ])

  expect(next.text).toBe("[Image #1]\n\nlost ")
  expect(next.images.map((i) => i.number)).toEqual([1])
})

test("bytes become base64", () => {
  expect(bytesToBase64(new Uint8Array([104, 105]))).toBe("aGk=")
  expect(bytesToBase64(new Uint8Array(100_000)).length).toBe(133_336)
})
