import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

const UserMessageBody = Schema.Struct({
  type: Schema.Literal("user_message"),
  text: Schema.String,
})
const AssistantTextBody = Schema.Struct({
  type: Schema.Literal("assistant_text"),
  text: Schema.String,
})
const ThinkingBody = Schema.Struct({
  type: Schema.Literal("thinking"),
  text: Schema.String,
})
const ToolCallBody = Schema.Struct({
  type: Schema.Literal("tool_call"),
  toolCallId: Schema.String,
  name: Schema.String,
  input: Schema.Unknown,
})
const ToolResultBody = Schema.Struct({
  type: Schema.Literal("tool_result"),
  toolCallId: Schema.String,
  output: Schema.String,
  isError: Schema.Boolean,
})
// One turn's consumption; a session's total is the sum of its usage events.
const UsageBody = Schema.Struct({
  type: Schema.Literal("usage"),
  inputTokens: Schema.Int,
  outputTokens: Schema.Int,
  costUsd: Schema.Number,
})
const StatusBody = Schema.Struct({
  type: Schema.Literal("status"),
  status: Schema.Literals(["running", "idle"]),
})

const eventBodies = [
  UserMessageBody,
  AssistantTextBody,
  ThinkingBody,
  ToolCallBody,
  ToolResultBody,
  UsageBody,
  StatusBody,
] as const

const raw = { raw: Schema.Unknown }
const stored = {
  id: Schema.String,
  sessionId: Schema.String,
  sequence: Schema.Int,
  at: Schema.DateTimeUtcFromMillis,
  raw: Schema.Unknown,
}

// What a harness emits; the server gives it an id, a session and a sequence when it stores it.
export const HarnessEvent = Schema.Union(
  eventBodies.map((body) => body.mapFields((f) => ({ ...f, ...raw }))),
)
export type HarnessEvent = typeof HarnessEvent.Type

export const TranscriptEvent = Schema.Union(
  eventBodies.map((body) => body.mapFields((f) => ({ ...f, ...stored }))),
)
export type TranscriptEvent = typeof TranscriptEvent.Type

const itemFields = {
  id: Schema.String,
  sessionId: Schema.String,
  position: Schema.Int,
}

export const MessageItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("message"),
  role: Schema.Literals(["user", "assistant"]),
  text: Schema.String,
})
export const ThinkingItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("thinking"),
  text: Schema.String,
})
export const ToolCallItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("tool_call"),
  toolCallId: Schema.String,
  name: Schema.String,
  input: Schema.Unknown,
  status: Schema.Literals(["running", "done", "error"]),
  output: Schema.NullOr(Schema.String),
})

export const UsageItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("usage"),
  inputTokens: Schema.Int,
  outputTokens: Schema.Int,
  costUsd: Schema.Number,
})

export const TranscriptItem = Schema.Union([MessageItem, ThinkingItem, ToolCallItem, UsageItem])
export type TranscriptItem = typeof TranscriptItem.Type

export const TranscriptPage = Schema.Struct({
  items: Schema.Array(TranscriptItem),
  hasBefore: Schema.Boolean,
  hasAfter: Schema.Boolean,
})
export type TranscriptPage = typeof TranscriptPage.Type

export const TranscriptItemChange = Schema.Union([
  Schema.Struct({ type: Schema.Literal("page"), page: TranscriptPage }),
  Schema.Struct({ type: Schema.Literal("upsert"), item: TranscriptItem }),
])
export type TranscriptItemChange = typeof TranscriptItemChange.Type

export const TranscriptRpcs = RpcGroup.make(
  // `position: null` anchors the page at the end of the transcript.
  Rpc.make("transcript.getItems", {
    payload: {
      sessionId: Schema.String,
      position: Schema.NullOr(Schema.Int),
      before: Schema.Int,
      after: Schema.Int,
    },
    success: TranscriptPage,
  }),
  // First element: the last `before` items, read after the server subscribed; then upserts.
  Rpc.make("transcript.watchItems", {
    payload: { sessionId: Schema.String, before: Schema.Int },
    success: TranscriptItemChange,
    stream: true,
  }),
)
