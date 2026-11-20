import type { ImageRef } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { imageMarker, messageParts } from "./message-parts.ts"

const shot: ImageRef = { id: "a", number: 3, mediaType: "image/png" }

test("a marker of one of the message's images becomes that image, between text runs", () => {
  expect(messageParts("see [Image #3]\nthen", [shot])).toEqual([
    { type: "text", text: "see " },
    { type: "image", image: shot },
    { type: "text", text: "\nthen" },
  ])
})

test("a marker with no image stays text", () => {
  expect(messageParts("[Image #9] gone", [shot])).toEqual([
    { type: "text", text: "[Image #9]" },
    { type: "text", text: " gone" },
  ])
})

test("a marker is written as the agent reads it", () => {
  expect(imageMarker(12)).toBe("[Image #12]")
})
