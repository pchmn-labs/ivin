import type { ApprovalNotOpen, SessionNotFound } from "@ivin/contracts/session"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"

const isTag = <E extends { readonly _tag: string }>(error: unknown, tag: E["_tag"]) =>
  errorTag(error) === tag

export const sendMessageFailure = (error: unknown): ActionFailure =>
  isTag<SessionNotFound>(error, "SessionNotFound")
    ? {
        text: "This session no longer exists, so the message was not sent. Start a new session to send it.",
        retry: false,
      }
    : { text: "The message was not sent.", retry: true }

export const createSessionFailure = (_error: unknown): ActionFailure => ({
  text: "The session was not created.",
  retry: true,
})

export const answerApprovalFailure = (error: unknown): ActionFailure =>
  isTag<SessionNotFound>(error, "SessionNotFound")
    ? { text: "This session no longer exists, so your answer was not sent.", retry: false }
    : isTag<ApprovalNotOpen>(error, "ApprovalNotOpen")
      ? { text: "This approval was already answered or has closed.", retry: false }
      : { text: "Your answer was not sent.", retry: true }
