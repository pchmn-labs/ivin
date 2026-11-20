import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const ImageMediaType = Schema.Literals([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
])
export type ImageMediaType = typeof ImageMediaType.Type

// `number` is unique in the session.
export const ImageRef = Schema.Struct({
  id: Schema.String,
  number: Schema.Int,
  mediaType: ImageMediaType,
})
export type ImageRef = typeof ImageRef.Type

export const ImageData = Schema.Struct({
  ...ImageRef.fields,
  base64: Schema.String,
})
export type ImageData = typeof ImageData.Type

export const ImageFile = Schema.Struct({ mediaType: ImageMediaType, base64: Schema.String })
export type ImageFile = typeof ImageFile.Type

export const SessionImage = Schema.Struct({
  ...ImageRef.fields,
  messageId: Schema.String,
  messageText: Schema.String,
})
export type SessionImage = typeof SessionImage.Type

const UserMessageBody = Schema.Struct({
  type: Schema.Literal("user_message"),
  text: Schema.String,
  // Absent on messages stored before images existed.
  images: Schema.optional(Schema.Array(ImageRef)),
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

const workingFolderFields = {
  path: Schema.String,
  inWorktree: Schema.Boolean,
  branch: Schema.NullOr(Schema.String),
  // `creation`: a new worktree; `choice`: a worktree the user picked before the first message;
  // `adoption`: the agent entered a worktree it made, or left one;
  // `pick`: the folder the user picked after the previous one was deleted.
  cause: Schema.Literals(["creation", "choice", "adoption", "branch_picker", "pick"]),
  // False when git does not ignore `.worktrees/`, so the checkout lists it as untracked.
  worktreesIgnored: Schema.Boolean,
}
const WorkingFolderBody = Schema.Struct({
  type: Schema.Literal("working_folder"),
  ...workingFolderFields,
})

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
  WorkingFolderBody,
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
  images: Schema.Array(ImageRef),
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

export const WorkingFolderItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("working_folder"),
  ...workingFolderFields,
})

export const TranscriptItem = Schema.Union([
  MessageItem,
  ThinkingItem,
  ToolCallItem,
  ApprovalItem,
  UsageItem,
  ErrorItem,
  InterruptionItem,
  WorkingFolderItem,
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

export class ImageNotFound extends Schema.TaggedError<ImageNotFound>()("ImageNotFound", {
  imageId: Schema.String,
}) {}

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
  Rpc.make("transcript.getImage", {
    payload: { imageId: Schema.String },
    success: ImageFile,
    error: ImageNotFound,
  }),
  // Every image the user sent in the session, in transcript order.
  Rpc.make("transcript.listImages", {
    payload: { sessionId: Schema.String },
    success: Schema.Array(SessionImage),
  }),
)
