import { expect, test } from "vitest"
import { unsent, userMessageEvent } from "./user-message.ts"

const message = {
  id: "m1",
  text: "look",
  images: [{ id: "i1", number: 1, mediaType: "image/png" as const, base64: "AAAA" }],
}

test("a message waiting to be sent keeps its images without their data", () => {
  expect(unsent(message)).toEqual({
    id: "m1",
    text: "look",
    images: [{ id: "i1", number: 1, mediaType: "image/png" }],
  })
})

test("a message that starts a turn is stored without the steer flag", () => {
  expect(userMessageEvent(message)).toEqual({
    type: "user_message",
    text: "look",
    images: [{ id: "i1", number: 1, mediaType: "image/png" }],
    steer: undefined,
    raw: null,
  })
})

test("a message sent during a turn is stored as a steer", () => {
  expect(userMessageEvent(unsent(message), true)).toMatchObject({ steer: true })
})
