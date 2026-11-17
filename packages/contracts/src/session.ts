import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

// `waiting`: the agent waits on the user, such as an approval.
export const SessionStatus = Schema.Literals(["working", "waiting", "idle", "failed"])
export type SessionStatus = typeof SessionStatus.Type

export const Session = Schema.Struct({
  id: Schema.String,
  projectPath: Schema.String,
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
  Rpc.make("session.sendMessage", {
    payload: { sessionId: Schema.String, messageId: Schema.String, text: Schema.String },
    success: Session,
    error: SessionNotFound,
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
