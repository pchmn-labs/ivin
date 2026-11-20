import { expect, test } from "vitest"
import { imageRefusal, refusalMessage } from "./image-refusal.ts"

const MB = 1024 * 1024

test("an image of an accepted type within the limit is accepted", () => {
  expect(imageRefusal({ name: "a.png", type: "image/png", size: MB }, 5 * MB)).toBeNull()
})

test("a file that is not an accepted image, or too large, is refused with its reason", () => {
  expect(imageRefusal({ name: "spec.pdf", type: "application/pdf", size: 10 }, 5 * MB)).toEqual({
    name: "spec.pdf",
    reason: "type",
  })
  expect(imageRefusal({ name: "a.svg", type: "image/svg+xml", size: 10 }, 5 * MB)?.reason).toBe(
    "type",
  )
  expect(imageRefusal({ name: "big.png", type: "image/png", size: 7.2 * MB }, 5 * MB)).toEqual({
    name: "big.png",
    reason: "size",
    size: 7.2 * MB,
  })
})

test("the message names the file and what the agent takes", () => {
  expect(refusalMessage([{ name: "spec.pdf", reason: "type" }], "Claude", 5 * MB)).toBe(
    "spec.pdf is not an image Claude can read. Use PNG, JPEG, GIF or WebP.",
  )
  expect(
    refusalMessage([{ name: "big.png", reason: "size", size: 7.2 * MB }], "Claude", 5 * MB),
  ).toBe("big.png is 7.2 MB; Claude takes images up to 5 MB.")
  expect(
    refusalMessage(
      [
        { name: "a.pdf", reason: "type" },
        { name: "b.png", reason: "size", size: 6 * MB },
      ],
      "Claude",
      5 * MB,
    ),
  ).toBe("2 files were not added: Claude takes PNG, JPEG, GIF or WebP images up to 5 MB.")
})
