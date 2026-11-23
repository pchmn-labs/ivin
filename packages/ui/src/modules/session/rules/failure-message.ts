import type {
  ApprovalNotOpen,
  QuestionNotOpen,
  CheckoutInUse,
  CheckoutRefused,
  GitRefused,
  SessionAlreadyStarted,
  SessionWorking,
  SessionNotFound,
  WorkingFolderDeleted,
  WorktreeFailure,
  WorktreeNotCreated,
} from "@ivin/contracts/session"
import type { ProjectNotTrusted } from "@ivin/contracts/project"
import type { WorktreeGitFailed } from "@ivin/contracts/worktree"
import type { RunOption } from "@ivin/contracts/transcript"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import type { RunOptions } from "@ivin/contracts/session"
import { RUN_OPTIONS } from "./run-options.ts"
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
  if (isTag<WorkingFolderDeleted>(error, "WorkingFolderDeleted")) {
    return {
      text: "This session's worktree was deleted, so the message was not sent. Pick where the agent continues, then send it again.",
      retryable: false,
    }
  }
  if (isTag<ProjectNotTrusted>(error, "ProjectNotTrusted")) {
    return {
      text: "The message was not sent: this session's folder is in no trusted project, so ivin does not start the agent there. Open the folder as a project and trust it, then send again.",
      retryable: true,
    }
  }
  return { text: "The message was not sent.", retryable: true }
}

export const pickWorkingFolderFailure = (error: unknown): ActionFailure => {
  if (isTag<SessionNotFound>(error, "SessionNotFound")) {
    return { text: "This session no longer exists.", retryable: false }
  }
  if (isTag<WorktreeNotCreated>(error, "WorktreeNotCreated")) {
    const reason = (error as WorktreeNotCreated).reason
    return reason === "no_default_branch"
      ? {
          text: "The worktree was not created: origin has no main, master or default branch to start from. Pick another folder.",
          retryable: false,
        }
      : reason === "not_a_worktree"
        ? { text: "This worktree no longer exists. Pick another folder.", retryable: false }
        : WORKTREE_FAILURES[reason]
  }
  return { text: "The working folder was not changed.", retryable: true }
}

const NOT_CHANGED: Record<RunOption, string> = {
  model: "model",
  effort: "effort",
  permissionMode: "permission mode",
}

export const setRunOptionsFailure = (
  error: unknown,
  options: Partial<RunOptions>,
): ActionFailure => {
  if (isTag<SessionNotFound>(error, "SessionNotFound")) {
    return { text: "This session no longer exists.", retryable: false }
  }
  const changed = RUN_OPTIONS.filter((option) => options[option] !== undefined)
  const what = changed.length === 1 ? `The ${NOT_CHANGED[changed[0]!]} was` : "The run options were"
  return { text: `${what} not changed.`, retryable: true }
}

export const sendNowFailure = (error: unknown): ActionFailure =>
  isTag<SessionNotFound>(error, "SessionNotFound")
    ? { text: "This session no longer exists.", retryable: false }
    : { text: "The messages were not sent now.", retryable: true }

export const renameFailure = (error: unknown): ActionFailure =>
  isTag<SessionNotFound>(error, "SessionNotFound")
    ? { text: "This session no longer exists.", retryable: false }
    : { text: "The session was not renamed.", retryable: true }

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

export const answerQuestionFailure = (error: unknown): ActionFailure =>
  isTag<SessionNotFound>(error, "SessionNotFound")
    ? { text: "This session no longer exists, so your answers were not sent.", retryable: false }
    : isTag<QuestionNotOpen>(error, "QuestionNotOpen")
      ? {
          text: "The agent no longer waits on these questions, so there is nothing left to answer.",
          retryable: false,
        }
      : { text: "Your answers were not sent.", retryable: true }

export type CheckoutAction = "switch" | "fastForward"

export interface CheckoutFailure extends ActionFailure {
  readonly gitMessage: string | null
  readonly blockedByLocalChanges: boolean
}

const NOT_DONE: Record<CheckoutAction, string> = {
  switch: "The checkout was not switched to the default branch, or not brought up to date.",
  fastForward: "The branch was not pulled.",
}

export const checkoutFailure = (error: unknown, action: CheckoutAction): CheckoutFailure => {
  const none = { gitMessage: null, blockedByLocalChanges: false }
  if (isTag<GitRefused>(error, "GitRefused")) {
    const { message, blockedByLocalChanges, stash } = error as GitRefused
    const kept =
      stash === undefined
        ? ""
        : ` Your changes are in the stash "${stash}": run git stash pop to get them back.`
    return {
      text:
        kept !== ""
          ? `${NOT_DONE[action]}${kept}`
          : blockedByLocalChanges
            ? `${NOT_DONE[action]} Local changes are in the way: stash them, or fix what git reports.`
            : `${NOT_DONE[action]} Fix what git reports, then retry.`,
      retryable: true,
      gitMessage: message,
      blockedByLocalChanges,
    }
  }
  if (isTag<CheckoutInUse>(error, "CheckoutInUse")) {
    return {
      text: "Another session's agent is working in the checkout. Retry once it is done, or start this session in a new worktree.",
      retryable: true,
      ...none,
    }
  }
  if (isTag<SessionAlreadyStarted>(error, "SessionAlreadyStarted")) {
    return {
      text: "The session has started, so its checkout stays as it is.",
      retryable: false,
      ...none,
    }
  }
  if (isTag<SessionNotFound>(error, "SessionNotFound")) {
    return { text: "This session no longer exists.", retryable: false, ...none }
  }
  return { text: NOT_DONE[action], retryable: true, ...none }
}

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

export const listWorktreesFailure =
  "ivin could not list this project's worktrees. Fix what git reports, then retry."

export const listBranchesFailure = (error: unknown) => ({
  text: "ivin could not list this project's branches. Fix what git reports, then try again.",
  gitMessage: isTag<WorktreeGitFailed>(error, "WorktreeGitFailed")
    ? (error as WorktreeGitFailed).gitMessage
    : null,
})
