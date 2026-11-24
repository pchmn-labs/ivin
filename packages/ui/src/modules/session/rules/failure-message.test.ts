import { expect, test } from "vitest"
import {
  answerApprovalFailure,
  answerQuestionFailure,
  checkoutFailure,
  pickWorkingFolderFailure,
  createSessionFailure,
  renameFailure,
  sendNowFailure,
  sendMessageFailure,
  setRunOptionsFailure,
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

test("answers to questions the agent no longer waits on say so and offer no retry", () => {
  const questionNotOpen = { _tag: "QuestionNotOpen", sessionId: "s1", requestId: "q1" }

  expect(answerQuestionFailure(sessionNotFound).retryable).toBe(false)
  expect(answerQuestionFailure(questionNotOpen)).toEqual({
    text: "The agent no longer waits on these questions, so there is nothing left to answer.",
    retryable: false,
  })
  expect(answerQuestionFailure(unknown).retryable).toBe(true)
})

const worktreeNotCreated = (reason: string) => ({
  _tag: "WorktreeNotCreated",
  sessionId: "s1",
  reason,
})

test("a worktree git refused points at git's output in the transcript, and can be retried", () => {
  expect(sendMessageFailure(worktreeNotCreated("git"))).toEqual({
    text: expect.stringMatching(/^The worktree was not created.*transcript/),
    retryable: true,
  })
})

test("a fetch of origin that timed out says to check the connection", () => {
  const failure = sendMessageFailure(worktreeNotCreated("fetch_timed_out"))
  expect(failure.text).toMatch(/connection/)
  expect(failure.retryable).toBe(true)
})

test("an origin with no default branch cannot be retried", () => {
  const failure = sendMessageFailure(worktreeNotCreated("no_default_branch"))
  expect(failure.retryable).toBe(false)
})

test("git's refusal to switch or pull carries its message, and says when local changes are the cause", () => {
  const blocked = {
    _tag: "GitRefused",
    sessionId: "s1",
    message: "error: …",
    blockedByLocalChanges: true,
  }
  expect(checkoutFailure(blocked, "fastForward")).toMatchObject({
    gitMessage: "error: …",
    blockedByLocalChanges: true,
    retryable: true,
  })
  expect(checkoutFailure(blocked, "fastForward").text).toMatch(
    /^The branch was not pulled\. Local changes/,
  )
  const diverged = { ...blocked, blockedByLocalChanges: false }
  expect(checkoutFailure(diverged, "switch").text).toBe(
    "The checkout was not switched to the default branch, or not brought up to date. Fix what git reports, then retry.",
  )
})

test("a checkout another agent works in can be retried once it is done", () => {
  expect(checkoutFailure({ _tag: "CheckoutInUse", sessionId: "s1" }, "switch")).toMatchObject({
    retryable: true,
    text: expect.stringMatching(/^Another session's agent is working in the checkout/),
  })
})

test("a switch after the first message, or for a removed session, offers no retry", () => {
  expect(
    checkoutFailure({ _tag: "SessionAlreadyStarted", sessionId: "s1" }, "switch"),
  ).toMatchObject({
    retryable: false,
    gitMessage: null,
  })
  expect(checkoutFailure(sessionNotFound, "fastForward").retryable).toBe(false)
  expect(checkoutFailure(unknown, "fastForward")).toEqual({
    text: "The branch was not pulled.",
    retryable: true,
    gitMessage: null,
    blockedByLocalChanges: false,
  })
})

test("a run option change that failed names the option and offers a retry", () => {
  expect(setRunOptionsFailure(new Error("lost"), { model: "opus" })).toEqual({
    text: "The model was not changed.",
    retryable: true,
  })
  expect(setRunOptionsFailure(new Error("lost"), { model: "a", effort: "b" }).text).toBe(
    "The run options were not changed.",
  )
})

test("a message refused in a folder outside every trusted project says how to trust it", () => {
  const failure = sendMessageFailure({ _tag: "ProjectNotTrusted", path: "/tmp/x" })
  expect(failure.text).toMatch(/no trusted project/)
  expect(failure.text).toMatch(/trust it, then send again/)
})

test("a pull refused after a stash names the stash that holds the changes", () => {
  const kept = {
    _tag: "GitRefused",
    sessionId: "s1",
    message: "fatal: Not possible to fast-forward",
    blockedByLocalChanges: false,
    stash: "WIP before pulling",
  }
  expect(checkoutFailure(kept, "fastForward").text).toBe(
    'The branch was not pulled. Your changes are in the stash "WIP before pulling": run git stash pop to get them back.',
  )
})

test("a Send now or a rename that failed says what did not happen and offers a retry", () => {
  expect(sendNowFailure(new Error("lost"))).toEqual({
    text: "The messages were not sent now.",
    retryable: true,
  })
  expect(sendNowFailure(sessionNotFound).retryable).toBe(false)
  expect(renameFailure(new Error("lost"))).toEqual({
    text: "The session was not renamed.",
    retryable: true,
  })
  expect(renameFailure(sessionNotFound)).toEqual({
    text: "This session no longer exists.",
    retryable: false,
  })
})

test("a working folder picked while the agent works can be picked again once it stops", () => {
  const failure = pickWorkingFolderFailure({ _tag: "SessionWorking", sessionId: "s1" })
  expect(failure).toEqual({
    text: "The agent is working. Pick a folder once it stops.",
    retryable: true,
  })
})
