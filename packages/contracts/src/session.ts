import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

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
  status: SessionStatus,
  statusChangedAt: Schema.DateTimeUtcFromMillis,
  createdAt: Schema.DateTimeUtcFromMillis,
  lastActivityAt: Schema.DateTimeUtcFromMillis,
})
export type Session = typeof Session.Type

export class SessionNotFound extends Schema.TaggedError<SessionNotFound>()("SessionNotFound", {
  sessionId: Schema.String,
}) {}

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
    payload: { projectPath: Schema.String, model: Schema.String },
    success: Session,
  }),
  Rpc.make("session.list", {
    payload: { projectPath: Schema.String },
    success: Schema.Array(Session),
  }),
  Rpc.make("session.rename", {
    payload: { sessionId: Schema.String, title: Schema.String },
    success: Session,
    error: SessionNotFound,
  }),
  // The renderer picks `messageId`, so its optimistic message and the stored event share an id.
  // `workingFolder` is read on the first message only; the checkout when absent.
  Rpc.make("session.sendMessage", {
    payload: {
      sessionId: Schema.String,
      messageId: Schema.String,
      text: Schema.String,
      workingFolder: Schema.optional(WorkingFolderChoice),
    },
    success: Session,
    error: Schema.Union([SessionNotFound, WorktreeNotCreated, WorkingFolderDeleted]),
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
  // First every session of the project, read after the server subscribed; then each change.
  Rpc.make("session.watch", {
    payload: { projectPath: Schema.String },
    success: Session,
    stream: true,
  }),
)
