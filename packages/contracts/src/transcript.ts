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
const ApprovalRequestBody = Schema.Struct({
  type: Schema.Literal("approval_request"),
  requestId: Schema.String,
  toolCallId: Schema.NullOr(Schema.String),
  name: Schema.String,
  input: Schema.Unknown,
})
const ApprovalDecisionBody = Schema.Struct({
  type: Schema.Literal("approval_decision"),
  requestId: Schema.String,
  allow: Schema.Boolean,
})
const StatusBody = Schema.Struct({
  type: Schema.Literal("status"),
  status: Schema.Literals(["running", "idle"]),
})
// One turn's consumption; a session's total is the sum of its usage events.
const UsageBody = Schema.Struct({
  type: Schema.Literal("usage"),
  inputTokens: Schema.Int,
  outputTokens: Schema.Int,
  cacheReadTokens: Schema.Int,
  cacheWriteTokens: Schema.Int,
  costUsd: Schema.NullOr(Schema.Number),
})
const ErrorBody = Schema.Struct({
  type: Schema.Literal("error"),
  message: Schema.String,
})

const InterruptionBody = Schema.Struct({ type: Schema.Literal("interruption") })

const eventBodies = [
  UserMessageBody,
  AssistantTextBody,
  ThinkingBody,
  ToolCallBody,
  ToolResultBody,
  ApprovalRequestBody,
  ApprovalDecisionBody,
  UsageBody,
  StatusBody,
  ErrorBody,
  InterruptionBody,
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

// Streamed text of the block being written; never stored, the finished block arrives as an event.
export const HarnessDelta = Schema.Struct({
  type: Schema.Literal("delta"),
  kind: Schema.Literals(["assistant_text", "thinking"]),
  text: Schema.String,
})
export type HarnessDelta = typeof HarnessDelta.Type

// Never stored as an event.
export const HarnessProviderSession = Schema.Struct({
  type: Schema.Literal("provider_session"),
  providerSessionId: Schema.String,
})
export type HarnessProviderSession = typeof HarnessProviderSession.Type

export const HarnessOutput = Schema.Union([HarnessEvent, HarnessDelta, HarnessProviderSession])
export type HarnessOutput = typeof HarnessOutput.Type

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

export const ApprovalItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("approval"),
  requestId: Schema.String,
  toolCallId: Schema.NullOr(Schema.String),
  name: Schema.String,
  input: Schema.Unknown,
  decision: Schema.NullOr(Schema.Literals(["allow", "deny"])),
})

export const UsageItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("usage"),
  inputTokens: Schema.Int,
  outputTokens: Schema.Int,
  costUsd: Schema.NullOr(Schema.Number),
})

export const ErrorItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("error"),
  message: Schema.String,
})

export const InterruptionItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("interruption"),
})

export const TranscriptItem = Schema.Union([
  MessageItem,
  ThinkingItem,
  ToolCallItem,
  ApprovalItem,
  UsageItem,
  ErrorItem,
  InterruptionItem,
])
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
  // Text to append to item `itemId`, created at `position` if the renderer doesn't hold it yet.
  Schema.Struct({
    type: Schema.Literal("delta"),
    sessionId: Schema.String,
    itemId: Schema.String,
    position: Schema.Int,
    kind: Schema.Literals(["message", "thinking"]),
    text: Schema.String,
  }),
])
export type TranscriptItemChange = typeof TranscriptItemChange.Type
export type TranscriptDelta = Extract<TranscriptItemChange, { type: "delta" }>

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
