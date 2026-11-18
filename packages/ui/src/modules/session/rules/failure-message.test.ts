import { expect, test } from "vitest"
import {
  answerApprovalFailure,
  createSessionFailure,
  sendMessageFailure,
} from "./failure-message.ts"

const sessionNotFound = { _tag: "SessionNotFound", sessionId: "s1" }
const approvalNotOpen = { _tag: "ApprovalNotOpen", sessionId: "s1", requestId: "r1" }
const unknown = new Error("socket closed")

test("a message to a session that no longer exists says so and offers no retry", () => {
  const failure = sendMessageFailure(sessionNotFound)
  expect(failure.retryable).toBe(false)
  expect(failure.text).not.toBe(sendMessageFailure(unknown).text)
  expect(failure.text).toMatch(/no longer exists/)
})

test("a message that failed for another reason can be retried", () => {
  expect(sendMessageFailure(unknown)).toEqual({
    text: "The message was not sent.",
    retryable: true,
  })
})

test("a session that was not created can be retried", () => {
  expect(createSessionFailure(unknown)).toEqual({
    text: "The session was not created.",
    retryable: true,
  })
})

test("an approval answer has a message for each error type and a default", () => {
  expect(answerApprovalFailure(sessionNotFound).retryable).toBe(false)
  expect(answerApprovalFailure(approvalNotOpen).retryable).toBe(false)
  expect(answerApprovalFailure(approvalNotOpen).text).toMatch(/no longer open/)
  expect(answerApprovalFailure(unknown)).toEqual({
    text: "Your answer was not sent.",
    retryable: true,
  })
})
