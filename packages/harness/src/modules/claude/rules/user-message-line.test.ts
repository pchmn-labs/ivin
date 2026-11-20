import { expect, test } from "vitest"
import { userMessageLine } from "./user-message-line.ts"

test("a text message becomes one text block", () => {
  expect(JSON.parse(userMessageLine({ text: "hello", images: [] }))).toEqual({
    type: "user",
    message: { role: "user", content: [{ type: "text", text: "hello" }] },
  })
})

test("a message with images becomes image blocks before its text", () => {
  const line = userMessageLine({
    text: "what is this?",
    images: [
      { id: "i1", mediaType: "image/png", base64: "iVBO" },
      { id: "i2", mediaType: "image/webp", base64: "UklG" },
    ],
  })
  expect(JSON.parse(line).message.content).toEqual([
    { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBO" } },
    { type: "image", source: { type: "base64", media_type: "image/webp", data: "UklG" } },
    { type: "text", text: "what is this?" },
  ])
})

test("images with no text send no empty text block", () => {
  const line = userMessageLine({
    text: "",
    images: [{ id: "i1", mediaType: "image/png", base64: "iVBO" }],
  })
  expect(JSON.parse(line).message.content).toEqual([
    { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBO" } },
  ])
})
