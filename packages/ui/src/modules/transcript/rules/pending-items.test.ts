import { expect, test } from "vitest"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { pendingApproval, pendingQuestion } from "./pending-items.ts"
const approval = (
  id: string,
  decision: "allow" | "deny" | "unanswered" | null,
): TranscriptItem => ({
  id,
  sessionId: "s",
  position: 0,
  at: 0,
  type: "approval",
  requestId: `r-${id}`,
  toolCallId: null,
  name: "Bash",
  input: { command: "ls" },
  decision,
})

test("the pending approval is the last unanswered one", () => {
  expect(
    pendingApproval([approval("a", null), approval("b", "allow"), approval("c", null)])?.id,
  ).toBe("c")
})

test("a transcript whose approvals are all answered or left unanswered has none pending", () => {
  expect(pendingApproval([approval("a", "deny"), approval("b", "unanswered")])).toBeUndefined()
  expect(pendingApproval([])).toBeUndefined()
})
const question = (
  id: string,
  status: "open" | "answered" | "declined" | "unanswered",
): TranscriptItem => ({
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

test("a transcript whose questions are all answered, declined or left unanswered has none pending", () => {
  expect(
    pendingQuestion([
      question("a", "answered"),
      question("b", "declined"),
      question("c", "unanswered"),
    ]),
  ).toBeUndefined()
  expect(pendingQuestion([])).toBeUndefined()
})
