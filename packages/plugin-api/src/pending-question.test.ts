import { expect, test } from "vitest"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { pendingQuestion } from "./pending-question.ts"

const question = (id: string, status: "open" | "answered" | "declined"): TranscriptItem => ({
  id,
  sessionId: "s",
  position: 0,
  at: 0,
  type: "question",
  requestId: `q-${id}`,
  toolCallId: null,
  questions: [],
  status,
  answers: [],
})

test("the pending question is the last one still open", () => {
  expect(
    pendingQuestion([question("a", "open"), question("b", "answered"), question("c", "open")])?.id,
  ).toBe("c")
})

test("a transcript whose questions are all answered or declined has none pending", () => {
  expect(pendingQuestion([question("a", "answered"), question("b", "declined")])).toBeUndefined()
  expect(pendingQuestion([])).toBeUndefined()
})
