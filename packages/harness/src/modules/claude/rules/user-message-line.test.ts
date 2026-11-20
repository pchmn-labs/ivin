import type { ImageData } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { userMessageLine } from "./user-message-line.ts"

const png: ImageData = { id: "i1", number: 1, mediaType: "image/png", base64: "iVBO" }
const webp: ImageData = { id: "i2", number: 2, mediaType: "image/webp", base64: "UklG" }
const block = ({ mediaType, base64 }: ImageData) => ({
  type: "image",
  source: { type: "base64", media_type: mediaType, data: base64 },
})
const content = (line: string) => JSON.parse(line).message.content

test("a text message becomes one text block", () => {
  expect(JSON.parse(userMessageLine({ text: "hello", images: [] }))).toEqual({
    type: "user",
    message: { role: "user", content: [{ type: "text", text: "hello" }] },
  })
})

test("each image block follows the text up to its marker", () => {
  const line = userMessageLine({
    text: "the test fails: [Image #2]\nand the card overflows [Image #1] on mobile",
    images: [webp, png],
  })
  expect(content(line)).toEqual([
    { type: "text", text: "the test fails: [Image #2]" },
    block(webp),
    { type: "text", text: "\nand the card overflows [Image #1]" },
    block(png),
    { type: "text", text: " on mobile" },
  ])
})

test("an image whose marker is missing comes first, and a message of images alone has no text block", () => {
  expect(content(userMessageLine({ text: "", images: [png] }))).toEqual([block(png)])
  expect(content(userMessageLine({ text: "see [Image #2]", images: [png, webp] }))).toEqual([
    block(png),
    { type: "text", text: "see [Image #2]" },
    block(webp),
  ])
})

test("a marker with no image stays text", () => {
  expect(content(userMessageLine({ text: "[Image #9] is gone", images: [] }))).toEqual([
    { type: "text", text: "[Image #9] is gone" },
  ])
})
