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

test("a worktree git refused keeps git's output to show, and can be retried", () => {
  const failure = sendMessageFailure({
    _tag: "WorktreeNotCreated",
    sessionId: "s1",
    reason: "git",
    gitMessage: "fatal: a branch named 'x' already exists",
  })
  expect(failure).toEqual({
    text: expect.stringMatching(/^The worktree was not created/),
    retryable: true,
    detail: "fatal: a branch named 'x' already exists",
  })
})

test("a fetch of origin that timed out says to check the connection", () => {
  const failure = sendMessageFailure({
    _tag: "WorktreeNotCreated",
    sessionId: "s1",
    reason: "fetch_timed_out",
    gitMessage: null,
  })
  expect(failure.text).toMatch(/connection/)
  expect(failure.retryable).toBe(true)
})

test("an origin with no default branch cannot be retried", () => {
  const failure = sendMessageFailure({
    _tag: "WorktreeNotCreated",
    sessionId: "s1",
    reason: "no_default_branch",
    gitMessage: null,
  })
  expect(failure.retryable).toBe(false)
})
