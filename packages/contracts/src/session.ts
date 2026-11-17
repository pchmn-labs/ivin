import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const Session = Schema.Struct({
  id: Schema.String,
  projectPath: Schema.String,
  title: Schema.String,
  createdAt: Schema.DateTimeUtcFromMillis,
  lastActivityAt: Schema.DateTimeUtcFromMillis,
})
export type Session = typeof Session.Type

export class SessionNotFound extends Schema.TaggedError<SessionNotFound>()("SessionNotFound", {
  sessionId: Schema.String,
}) {}

export const SessionRpcs = RpcGroup.make(
  Rpc.make("session.create", { payload: { projectPath: Schema.String }, success: Session }),
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
)
