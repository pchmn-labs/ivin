import type {
  ApprovalNotOpen,
  CheckoutRefused,
  SessionWorking,
  SessionNotFound,
  WorktreeFailure,
  WorktreeNotCreated,
} from "@ivin/contracts/session"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"

const isTag = <E extends { readonly _tag: string }>(error: unknown, tag: E["_tag"]) =>
  errorTag(error) === tag

const WORKTREE_FAILURES: Record<WorktreeFailure, ActionFailure> = {
  git: {
    text: "The worktree was not created. Fix what git reports in the transcript, then retry.",
    retryable: true,
  },
  fetch_timed_out: {
    text: "The worktree was not created: fetching origin took too long. Check the connection, then retry.",
    retryable: true,
  },
  no_default_branch: {
    text: "The worktree was not created: origin has no main, master or default branch to start from. Pick Current checkout to send the message.",
    retryable: false,
  },
  not_a_worktree: {
    text: "This worktree no longer exists. Pick another working folder to send the message.",
    retryable: false,
  },
}

export const sendMessageFailure = (error: unknown): ActionFailure => {
  if (isTag<SessionNotFound>(error, "SessionNotFound")) {
    return {
      text: "This session no longer exists, so the message was not sent. Start a new session to send it.",
      retryable: false,
    }
  }
  if (isTag<WorktreeNotCreated>(error, "WorktreeNotCreated")) {
    return WORKTREE_FAILURES[(error as WorktreeNotCreated).reason]
  }
  return { text: "The message was not sent.", retryable: true }
}

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

// `gitMessage` is shown under the text, because the user fixes the repository from it.
export const pickBranchFailure = (
  error: unknown,
  branch: string,
): ActionFailure & { readonly gitMessage: string | null } => {
  if (isTag<CheckoutRefused>(error, "CheckoutRefused")) {
    return {
      text: `Git refused to check out ${branch}. Fix what it reports, then pick the branch again.`,
      retryable: true,
      gitMessage: (error as CheckoutRefused).gitMessage,
    }
  }
  if (isTag<SessionWorking>(error, "SessionWorking")) {
    return {
      text: "The agent is working. Switch branches once it stops.",
      retryable: true,
      gitMessage: null,
    }
  }
  if (isTag<SessionNotFound>(error, "SessionNotFound")) {
    return { text: "This session no longer exists.", retryable: false, gitMessage: null }
  }
  return { text: `${branch} was not checked out.`, retryable: true, gitMessage: null }
}
