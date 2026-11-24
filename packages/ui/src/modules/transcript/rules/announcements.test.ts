import { expect, test } from "vitest"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { approvalAnnouncement, turnEndAnnouncement } from "./announcements.ts"

const message = (
  id: string,
  role: "user" | "assistant",
  text: string,
  parentToolCallId?: string,
): TranscriptItem => ({
  id,
  sessionId: "s",
  position: 0,
  at: 0,
  type: "message",
  role,
  text,
  images: [],
  steer: false,
  ...(parentToolCallId !== undefined && { parentToolCallId }),
})

test("a turn's end reads the agent's last message, not a subagent's nor the user's", () => {
  expect(
    turnEndAnnouncement([
      message("1", "user", "Fix the cart"),
      message("2", "assistant", "Looking at the cart."),
      message("3", "assistant", "The cart is fixed."),
      message("4", "assistant", "Subagent notes", "tool-1"),
    ]),
  ).toBe("The cart is fixed.")
  expect(turnEndAnnouncement([message("1", "user", "Fix the cart")])).toBeNull()
  expect(turnEndAnnouncement([message("1", "assistant", "  \n ")])).toBeNull()
})

test("a long message is cut near 150 characters, at a word, and its markdown marks are dropped", () => {
  const text = `## Done\n\nI **fixed** the \`cart\` total. ${"The tests pass again now. ".repeat(10)}`
  const announced = turnEndAnnouncement([message("1", "assistant", text)])!
  expect(announced.startsWith("Done I fixed the cart total. The tests pass")).toBe(true)
  expect(announced.length).toBeLessThanOrEqual(151)
  expect(announced.endsWith("…")).toBe(true)
  expect(announced.at(-2)).not.toBe(" ")
})

test("an approval names the session and the first line of what it asks to run", () => {
  expect(approvalAnnouncement("Fix the cart", "pnpm test\n--watch")).toBe(
    "Fix the cart needs your approval: pnpm test",
  )
})

test("a turn that ends before the agent writes anything has nothing to read", () => {
  expect(
    turnEndAnnouncement([
      message("1", "user", "Fix the cart"),
      message("2", "assistant", "The cart is fixed."),
      message("3", "user", "Now the checkout"),
    ]),
  ).toBeNull()
})
