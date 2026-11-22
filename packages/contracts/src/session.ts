import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { ImageData, ImageRef } from "./transcript.ts"

// `waiting`: the agent waits on the user, such as an approval.
export const SessionStatus = Schema.Literals([
  "preparing_worktree",
  "working",
  "waiting",
  "idle",
  "failed",
])
export type SessionStatus = typeof SessionStatus.Type

export const Harness = Schema.Literals(["claude", "codex", "acp", "scripted"])
export type Harness = typeof Harness.Type

export const RunOptions = Schema.Struct({
  model: Schema.String,
  effort: Schema.String,
  permissionMode: Schema.String,
})
export type RunOptions = typeof RunOptions.Type

// `value` is what the harness takes; `name` is what the user reads.
export const OfferedValue = Schema.Struct({
  value: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
})
export type OfferedValue = typeof OfferedValue.Type

export const OfferedModel = Schema.Struct({
  ...OfferedValue.fields,
  // The effort values this model accepts; empty when it takes no effort.
  efforts: Schema.Array(Schema.String),
  // A pinned earlier version, listed after the latest models.
  older: Schema.Boolean,
})
export type OfferedModel = typeof OfferedModel.Type

// What a harness offers for each run option, from its provider.
export const HarnessRunOptions = Schema.Struct({
  model: Schema.Struct({ values: Schema.Array(OfferedModel), default: Schema.String }),
  effort: Schema.Struct({ values: Schema.Array(OfferedValue), default: Schema.String }),
  permissionMode: Schema.Struct({ values: Schema.Array(OfferedValue), default: Schema.String }),
})
export type HarnessRunOptions = typeof HarnessRunOptions.Type

// `message`: the text the failed turn was sent with, for the composer to put back.
// `error`: what the agent reported, null when it reported nothing.
export const RelaunchFailure = Schema.Struct({
  previous: RunOptions,
  message: Schema.String,
  error: Schema.NullOr(Schema.String),
})
export type RelaunchFailure = typeof RelaunchFailure.Type

export const UnsentMessage = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  images: Schema.Array(ImageRef),
})
export type UnsentMessage = typeof UnsentMessage.Type

export const Session = Schema.Struct({
  id: Schema.String,
  projectPath: Schema.String,
  workingFolder: Schema.String,
  inWorktree: Schema.Boolean,
  // Null outside a git repository and on a detached HEAD.
  branch: Schema.NullOr(Schema.String),
  // The first user message is stored.
  started: Schema.Boolean,
  workingFolderDeleted: Schema.Boolean,
  title: Schema.String,
  harness: Harness,
  model: Schema.String,
  effort: Schema.String,
  permissionMode: Schema.String,
  relaunchFailure: Schema.NullOr(RelaunchFailure),
  // Sent while the agent works, and not read by it yet.
  pendingMessages: Schema.Array(UnsentMessage),
  // Pending when the turn was stopped or the agent ended, for the composer to put back.
  unreadMessages: Schema.Array(UnsentMessage),
  status: SessionStatus,
  statusChangedAt: Schema.DateTimeUtcFromMillis,
  createdAt: Schema.DateTimeUtcFromMillis,
  lastActivityAt: Schema.DateTimeUtcFromMillis,
  archivedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  // 0 before the first image; the next pasted image takes the number after it.
  lastImageNumber: Schema.Int,
})
export type Session = typeof Session.Type

// `removed`: the session was archived or deleted.
export const SessionChange = Schema.Union([
  Schema.TaggedStruct("changed", { session: Session }),
  Schema.TaggedStruct("removed", { sessionId: Schema.String, projectPath: Schema.String }),
])
export type SessionChange = typeof SessionChange.Type

export class SessionNotFound extends Schema.TaggedError<SessionNotFound>()("SessionNotFound", {
  sessionId: Schema.String,
}) {}

export const RenamedBy = Schema.Literals(["user", "agent"])
export type RenamedBy = typeof RenamedBy.Type

export class SessionTitleChosenByUser extends Schema.TaggedError<SessionTitleChosenByUser>()(
  "SessionTitleChosenByUser",
  { sessionId: Schema.String },
) {}

export class ApprovalNotOpen extends Schema.TaggedError<ApprovalNotOpen>()("ApprovalNotOpen", {
  sessionId: Schema.String,
  requestId: Schema.String,
}) {}

export class WorkingFolderDeleted extends Schema.TaggedError<WorkingFolderDeleted>()(
  "WorkingFolderDeleted",
  { sessionId: Schema.String },
) {}

export const WorkingFolderChoice = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("checkout") }),
  Schema.Struct({ kind: Schema.Literal("new_worktree") }),
  Schema.Struct({ kind: Schema.Literal("existing_worktree"), path: Schema.String }),
])
export type WorkingFolderChoice = typeof WorkingFolderChoice.Type

// `not_a_worktree`: the chosen folder is no longer one of the project's worktrees.
export const WorktreeFailure = Schema.Literals([
  "git",
  "fetch_timed_out",
  "no_default_branch",
  "not_a_worktree",
])
export type WorktreeFailure = typeof WorktreeFailure.Type

// With `reason: "git"`, git's output is in the session's transcript.
export class WorktreeNotCreated extends Schema.TaggedError<WorktreeNotCreated>()(
  "WorktreeNotCreated",
  { sessionId: Schema.String, reason: WorktreeFailure },
) {}

// Switching and fast-forwarding move the checkout under the agent, so only before the first message.
export class SessionAlreadyStarted extends Schema.TaggedError<SessionAlreadyStarted>()(
  "SessionAlreadyStarted",
  { sessionId: Schema.String },
) {}

// Another session's agent works in the checkout, which must not move under it.
export class CheckoutInUse extends Schema.TaggedError<CheckoutInUse>()("CheckoutInUse", {
  sessionId: Schema.String,
}) {}

export class CheckoutHasLocalChanges extends Schema.TaggedError<CheckoutHasLocalChanges>()(
  "CheckoutHasLocalChanges",
  { sessionId: Schema.String },
) {}

// `message` is git's own output, which the user fixes the repository from.
export class GitRefused extends Schema.TaggedError<GitRefused>()("GitRefused", {
  sessionId: Schema.String,
  message: Schema.String,
  blockedByLocalChanges: Schema.Boolean,
}) {}

export const LocalChangesChoice = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("stash") }),
  Schema.Struct({ kind: Schema.Literal("commit"), message: Schema.String }),
])
export type LocalChangesChoice = typeof LocalChangesChoice.Type

// A branch can only be picked while the agent is not running a turn.
export class SessionWorking extends Schema.TaggedError<SessionWorking>()("SessionWorking", {
  sessionId: Schema.String,
}) {}

export class CheckoutRefused extends Schema.TaggedError<CheckoutRefused>()("CheckoutRefused", {
  sessionId: Schema.String,
  // Git's own output, shown to the user, who fixes the repository from it.
  gitMessage: Schema.String,
}) {}

export const SessionRpcs = RpcGroup.make(
  Rpc.make("session.create", {
    payload: { projectPath: Schema.String },
    success: Session,
  }),
  Rpc.make("session.list", {
    payload: { projectPath: Schema.String },
    success: Schema.Array(Session),
  }),
  // Most recently archived first.
  Rpc.make("session.listArchived", {
    payload: { projectPath: Schema.String },
    success: Schema.Array(Session),
  }),
  // Stops the agent and closes the session's tab.
  Rpc.make("session.archive", {
    payload: { sessionId: Schema.String },
    error: SessionNotFound,
  }),
  // The session comes back with no tab.
  Rpc.make("session.restore", {
    payload: { sessionId: Schema.String },
    success: Session,
    error: SessionNotFound,
  }),
  // Stops the agent, closes the session's tab and erases the session with its transcript.
  Rpc.make("session.delete", {
    payload: { sessionId: Schema.String },
    error: SessionNotFound,
  }),
  Rpc.make("session.rename", {
    payload: {
      sessionId: Schema.String,
      title: Schema.String,
      by: Schema.optional(RenamedBy),
    },
    success: Session,
    error: Schema.Union([SessionNotFound, SessionTitleChosenByUser]),
  }),
  // The renderer picks `messageId`, so its optimistic message and the stored event share an id.
  // `workingFolder` is read on the first message only; the checkout when absent.
  Rpc.make("session.sendMessage", {
    payload: {
      sessionId: Schema.String,
      messageId: Schema.String,
      text: Schema.String,
      images: Schema.optional(Schema.Array(ImageData)),
      workingFolder: Schema.optional(WorkingFolderChoice),
    },
    success: Session,
    error: Schema.Union([SessionNotFound, WorktreeNotCreated, WorkingFolderDeleted]),
  }),
  Rpc.make("session.setRunOptions", {
    payload: {
      sessionId: Schema.String,
      options: Schema.Struct({
        model: Schema.optionalKey(Schema.String),
        effort: Schema.optionalKey(Schema.String),
        permissionMode: Schema.optionalKey(Schema.String),
      }),
    },
    success: Session,
    error: SessionNotFound,
  }),
  Rpc.make("session.pickWorkingFolder", {
    payload: { sessionId: Schema.String, workingFolder: WorkingFolderChoice },
    success: Session,
    error: Schema.Union([SessionNotFound, WorktreeNotCreated]),
  }),
  Rpc.make("session.answerApproval", {
    payload: { sessionId: Schema.String, requestId: Schema.String, allow: Schema.Boolean },
    success: Session,
    error: Schema.Union([SessionNotFound, ApprovalNotOpen]),
  }),
  // A branch held by another worktree, the checkout included, moves the session there; a remote
  // one (`origin/<name>`) is checked out as a tracking branch.
  Rpc.make("session.pickBranch", {
    payload: { sessionId: Schema.String, name: Schema.String, remote: Schema.Boolean },
    success: Session,
    error: Schema.Union([SessionNotFound, SessionWorking, CheckoutRefused]),
  }),
  // Stops the running turn; the agent keeps its process and the events received so far.
  Rpc.make("session.interrupt", {
    payload: { sessionId: Schema.String },
    success: Session,
    error: SessionNotFound,
  }),
  // Stops the running turn so the agent starts a new one with the pending messages.
  Rpc.make("session.sendNow", {
    payload: { sessionId: Schema.String },
    success: Session,
    error: SessionNotFound,
  }),
  // Checks out the default branch in the checkout, then fast-forwards it from origin.
  // Without `localChanges`, a checkout with local changes is refused.
  Rpc.make("session.switchToDefaultBranch", {
    payload: { sessionId: Schema.String, localChanges: Schema.optional(LocalChangesChoice) },
    success: Session,
    error: Schema.Union([
      SessionNotFound,
      SessionAlreadyStarted,
      CheckoutInUse,
      CheckoutHasLocalChanges,
      GitRefused,
    ]),
  }),
  // Fast-forwards the checkout's branch from `origin/<branch>`, never merging nor rebasing.
  Rpc.make("session.fastForward", {
    payload: { sessionId: Schema.String, stash: Schema.optional(Schema.Boolean) },
    success: Session,
    error: Schema.Union([SessionNotFound, SessionAlreadyStarted, CheckoutInUse, GitRefused]),
  }),
  // First every session of the project but the archived ones, read after the server subscribed;
  // then each change.
  Rpc.make("session.watch", {
    payload: { projectPath: Schema.String },
    success: SessionChange,
    stream: true,
  }),
)
