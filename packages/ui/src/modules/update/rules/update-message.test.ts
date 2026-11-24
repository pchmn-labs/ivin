import { expect, test } from "vitest"
import { failureMessage, restartPrompt } from "./update-message.ts"

test("each failure says what failed and what to do next", () => {
  expect(failureMessage("network")).toBe(
    "ivin could not reach GitHub to look for an update. Check your connection, then try again.",
  )
  expect(failureMessage("fingerprint")).toBe(
    "The downloaded update did not match its fingerprint, so ivin deleted it and kept this version. Try again.",
  )
  expect(failureMessage("notWritable")).toBe(
    "ivin cannot replace itself where it is installed. Move ivin to a folder you can write to, such as /Applications, then try again.",
  )
})

test("the restart asks for nothing when no agent is running", () => {
  expect(restartPrompt("0.4.0", 0)).toBeNull()
})

test("the restart names the agents it stops and says they resume", () => {
  expect(restartPrompt("0.4.0", 1)).toEqual({
    title: "Restart ivin to update to 0.4.0?",
    description:
      "1 agent is running. It stops now and resumes with your next message in its session.",
  })
  expect(restartPrompt("0.4.0", 3)?.description).toBe(
    "3 agents are running. They stop now and resume with your next message in their session.",
  )
})
