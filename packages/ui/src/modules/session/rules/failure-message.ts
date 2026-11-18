import type { ApprovalNotOpen, SessionNotFound } from "@ivin/contracts/session"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"

const isTag = <E extends { readonly _tag: string }>(error: unknown, tag: E["_tag"]) =>
  errorTag(error) === tag

export const sendMessageFailure = (error: unknown): ActionFailure =>
  isTag<SessionNotFound>(error, "SessionNotFound")
    ? {
        text: "This session no longer exists, so the message was not sent. Start a new session to send it.",
        retryable: false,
      }
    : { text: "The message was not sent.", retryable: true }

export const createSessionFailure = (_error: unknown): ActionFailure => ({
  text: "The session was not created.",
  retryable: true,
})

export const answerApprovalFailure = (error: unknown): ActionFailure =>
  isTag<SessionNotFound>(error, "SessionNotFound")
    ? { text: "This session no longer exists, so your answer was not sent.", retryable: false }
    : isTag<ApprovalNotOpen>(error, "ApprovalNotOpen")
      ? {
          text: "This approval is no longer open, so there is nothing left to answer.",
          retryable: false,
        }
      : { text: "Your answer was not sent.", retryable: true }
