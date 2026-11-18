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

export const Session = Schema.Struct({
  id: Schema.String,
  projectPath: Schema.String,
  workingFolder: Schema.String,
  inWorktree: Schema.Boolean,
  // Null outside a git repository and on a detached HEAD.
  branch: Schema.NullOr(Schema.String),
  // The first user message is stored.
  started: Schema.Boolean,
  title: Schema.String,
  model: Schema.String,
  status: SessionStatus,
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

// `branch: null` lets the server generate one.
export const WorkingFolderChoice = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("checkout") }),
  Schema.Struct({ kind: Schema.Literal("worktree"), branch: Schema.NullOr(Schema.String) }),
])
export type WorkingFolderChoice = typeof WorkingFolderChoice.Type

export const WorktreeFailure = Schema.Literals(["git", "fetch_timed_out", "no_default_branch"])
export type WorktreeFailure = typeof WorktreeFailure.Type

// `gitMessage` is git's output when `reason` is `git`.
export class WorktreeNotCreated extends Schema.TaggedError<WorktreeNotCreated>()(
  "WorktreeNotCreated",
  { sessionId: Schema.String, reason: WorktreeFailure, gitMessage: Schema.NullOr(Schema.String) },
) {}

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
    error: Schema.Union([SessionNotFound, WorktreeNotCreated]),
  }),
  Rpc.make("session.answerApproval", {
    payload: { sessionId: Schema.String, requestId: Schema.String, allow: Schema.Boolean },
    success: Session,
    error: Schema.Union([SessionNotFound, ApprovalNotOpen]),
  }),
  // Stops the running turn; the agent keeps its process and the events received so far.
  Rpc.make("session.interrupt", {
    payload: { sessionId: Schema.String },
    success: Session,
    error: SessionNotFound,
  }),
  // First every session of the project, read after the server subscribed; then each change.
  Rpc.make("session.watch", {
    payload: { projectPath: Schema.String },
    success: Session,
    stream: true,
  }),
)
