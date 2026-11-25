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
  // Names the image's file, so it holds no path separator.
  id: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9-]+$/)),
  number: Schema.Int,
  mediaType: ImageMediaType,
  // The user deleted its file; the message keeps its marker.
  deleted: Schema.optional(Schema.Boolean),
})
export type ImageRef = typeof ImageRef.Type

export const ImageSpace = Schema.Struct({
  images: Schema.Int,
  bytes: Schema.Int,
})
export type ImageSpace = typeof ImageSpace.Type

export const DeletedImages = Schema.Struct({
  ...ImageSpace.fields,
  imageIds: Schema.Array(Schema.String),
})
export type DeletedImages = typeof DeletedImages.Type

// Each field narrows the images taken; none: every image.
const ImageSelection = {
  olderThanDays: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  // Sessions with no tab, archived or not.
  inactiveSessions: Schema.optional(Schema.Boolean),
}

export const ImageData = Schema.Struct({
  ...ImageRef.fields,
  base64: Schema.String,
})
export type ImageData = typeof ImageData.Type

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
  steer: Schema.optional(Schema.Boolean),
})
// A step of a background subagent names the tool call that started it, and joins that task's run.
const parentToolCallId = { parentToolCallId: Schema.optional(Schema.String) }
const AssistantTextBody = Schema.Struct({
  type: Schema.Literal("assistant_text"),
  text: Schema.String,
  ...parentToolCallId,
})
const ThinkingBody = Schema.Struct({
  type: Schema.Literal("thinking"),
  text: Schema.String,
  ...parentToolCallId,
})
const ToolCallBody = Schema.Struct({
  type: Schema.Literal("tool_call"),
  toolCallId: Schema.String,
  name: Schema.String,
  input: Schema.Unknown,
  ...parentToolCallId,
})
const ToolResultBody = Schema.Struct({
  type: Schema.Literal("tool_result"),
  toolCallId: Schema.String,
  output: Schema.String,
  isError: Schema.Boolean,
  ...parentToolCallId,
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
export const QuestionOption = Schema.Struct({
  label: Schema.String,
  description: Schema.String,
})
export type QuestionOption = typeof QuestionOption.Type

export const Question = Schema.Struct({
  question: Schema.String,
  header: Schema.String,
  options: Schema.Array(QuestionOption),
  multiSelect: Schema.Boolean,
})
export type Question = typeof Question.Type

// `choices` holds the labels picked, or the user's own text in place of an option.
export const QuestionAnswer = Schema.Struct({
  question: Schema.String,
  choices: Schema.Array(Schema.String),
})
export type QuestionAnswer = typeof QuestionAnswer.Type

const QuestionRequestBody = Schema.Struct({
  type: Schema.Literal("question_request"),
  requestId: Schema.String,
  toolCallId: Schema.NullOr(Schema.String),
  questions: Schema.Array(Question),
})
// `answers: null`: the user declined the questions.
const QuestionAnswerBody = Schema.Struct({
  type: Schema.Literal("question_answer"),
  requestId: Schema.String,
  answers: Schema.NullOr(Schema.Array(QuestionAnswer)),
})
// Request `requestId`'s turn or run ended before the user answered it.
const RequestUnansweredBody = Schema.Struct({
  type: Schema.Literal("request_unanswered"),
  requestId: Schema.String,
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

// A subagent or a command the agent started in the background; it outlives the turn that started it.
export const TaskKind = Schema.Literals(["agent", "command"])
export type TaskKind = typeof TaskKind.Type

const TaskStartedBody = Schema.Struct({
  type: Schema.Literal("task_started"),
  taskId: Schema.String,
  toolCallId: Schema.String,
  kind: TaskKind,
  description: Schema.String,
})
// `stopped`: the user or the agent stopped it, or the run ended first.
export const TaskOutcome = Schema.Literals(["completed", "failed", "stopped"])
export type TaskOutcome = typeof TaskOutcome.Type

const TaskEndedBody = Schema.Struct({
  type: Schema.Literal("task_ended"),
  taskId: Schema.String,
  outcome: TaskOutcome,
  summary: Schema.String,
  // A command's output as it stood at the end, cut to its last lines; null for a subagent.
  output: Schema.NullOr(Schema.String),
})

// The user stopped a background task; the task's own end comes as `task_ended`.
const taskStopFields = { taskId: Schema.String, description: Schema.String }
const TaskStopBody = Schema.Struct({ type: Schema.Literal("task_stop"), ...taskStopFields })

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

export const RunOption = Schema.Literals(["model", "effort", "permissionMode"])
export type RunOption = typeof RunOption.Type

// The names are kept as they read at the change, as the harness may later rename or drop a value.
const runOptionFields = {
  option: RunOption,
  from: Schema.String,
  to: Schema.String,
  fromName: Schema.String,
  toName: Schema.String,
}
const RunOptionBody = Schema.Struct({ type: Schema.Literal("run_option"), ...runOptionFields })

const raw = { raw: Schema.Unknown }
const stored = {
  id: Schema.String,
  sessionId: Schema.String,
  sequence: Schema.Int,
  at: Schema.DateTimeUtcFromMillis,
}

// What a harness emits; the server gives it an id, a session and a sequence when it stores it.
export const HarnessEvent = Schema.Union([
  UserMessageBody.mapFields((f) => ({ ...f, ...raw })),
  AssistantTextBody.mapFields((f) => ({ ...f, ...raw })),
  ThinkingBody.mapFields((f) => ({ ...f, ...raw })),
  ToolCallBody.mapFields((f) => ({ ...f, ...raw })),
  ToolResultBody.mapFields((f) => ({ ...f, ...raw })),
  ApprovalRequestBody.mapFields((f) => ({ ...f, ...raw })),
  ApprovalDecisionBody.mapFields((f) => ({ ...f, ...raw })),
  QuestionRequestBody.mapFields((f) => ({ ...f, ...raw })),
  QuestionAnswerBody.mapFields((f) => ({ ...f, ...raw })),
  RequestUnansweredBody.mapFields((f) => ({ ...f, ...raw })),
  UsageBody.mapFields((f) => ({ ...f, ...raw })),
  StatusBody.mapFields((f) => ({ ...f, ...raw })),
  ErrorBody.mapFields((f) => ({ ...f, ...raw })),
  InterruptionBody.mapFields((f) => ({ ...f, ...raw })),
  TaskStartedBody.mapFields((f) => ({ ...f, ...raw })),
  TaskEndedBody.mapFields((f) => ({ ...f, ...raw })),
  WorkingFolderBody.mapFields((f) => ({ ...f, ...raw })),
  RunOptionBody.mapFields((f) => ({ ...f, ...raw })),
  TaskStopBody.mapFields((f) => ({ ...f, ...raw })),
])
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

// The agent took in a message sent while it worked. Never stored as an event.
export const HarnessMessageRead = Schema.Struct({
  type: Schema.Literal("message_read"),
  messageId: Schema.String,
})
export type HarnessMessageRead = typeof HarnessMessageRead.Type

// The file a running task writes its output to. Never stored as an event.
export const HarnessTaskOutputFile = Schema.Struct({
  type: Schema.Literal("task_output_file"),
  taskId: Schema.String,
  path: Schema.String,
})
export type HarnessTaskOutputFile = typeof HarnessTaskOutputFile.Type

export const HarnessOutput = Schema.Union([
  HarnessEvent,
  HarnessDelta,
  HarnessProviderSession,
  HarnessMessageRead,
  HarnessTaskOutputFile,
])
export type HarnessOutput = typeof HarnessOutput.Type

export const TranscriptEvent = Schema.Union([
  UserMessageBody.mapFields((f) => ({ ...f, ...stored })),
  AssistantTextBody.mapFields((f) => ({ ...f, ...stored })),
  ThinkingBody.mapFields((f) => ({ ...f, ...stored })),
  ToolCallBody.mapFields((f) => ({ ...f, ...stored })),
  ToolResultBody.mapFields((f) => ({ ...f, ...stored })),
  ApprovalRequestBody.mapFields((f) => ({ ...f, ...stored })),
  ApprovalDecisionBody.mapFields((f) => ({ ...f, ...stored })),
  QuestionRequestBody.mapFields((f) => ({ ...f, ...stored })),
  QuestionAnswerBody.mapFields((f) => ({ ...f, ...stored })),
  RequestUnansweredBody.mapFields((f) => ({ ...f, ...stored })),
  UsageBody.mapFields((f) => ({ ...f, ...stored })),
  StatusBody.mapFields((f) => ({ ...f, ...stored })),
  ErrorBody.mapFields((f) => ({ ...f, ...stored })),
  InterruptionBody.mapFields((f) => ({ ...f, ...stored })),
  TaskStartedBody.mapFields((f) => ({ ...f, ...stored })),
  TaskEndedBody.mapFields((f) => ({ ...f, ...stored })),
  WorkingFolderBody.mapFields((f) => ({ ...f, ...stored })),
  RunOptionBody.mapFields((f) => ({ ...f, ...stored })),
  TaskStopBody.mapFields((f) => ({ ...f, ...stored })),
])
export type TranscriptEvent = typeof TranscriptEvent.Type

const itemFields = {
  id: Schema.String,
  sessionId: Schema.String,
  position: Schema.Int,
  // Epoch milliseconds of the event that opened the item.
  at: Schema.Number,
}

// What a tool does, as its harness classifies it; `other` for a tool the harness does not know.
export const ToolKind = Schema.Literals([
  "command",
  "read",
  "edit",
  "search",
  "skill",
  "agent",
  "other",
])
export type ToolKind = typeof ToolKind.Type

export const MessageItem = Schema.Struct({
  ...itemFields,
  ...parentToolCallId,
  type: Schema.Literal("message"),
  role: Schema.Literals(["user", "assistant"]),
  text: Schema.String,
  images: Schema.Array(ImageRef),
  steer: Schema.Boolean,
})
export const ThinkingItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("thinking"),
  text: Schema.String,
  ...parentToolCallId,
})
export const ToolCallItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("tool_call"),
  toolCallId: Schema.String,
  name: Schema.String,
  kind: ToolKind,
  input: Schema.Unknown,
  status: Schema.Literals(["running", "done", "error"]),
  output: Schema.NullOr(Schema.String),
  ...parentToolCallId,
})

export const ApprovalItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("approval"),
  requestId: Schema.String,
  toolCallId: Schema.NullOr(Schema.String),
  name: Schema.String,
  input: Schema.Unknown,
  decision: Schema.NullOr(Schema.Literals(["allow", "deny", "unanswered"])),
})

export const QuestionItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("question"),
  requestId: Schema.String,
  toolCallId: Schema.NullOr(Schema.String),
  questions: Schema.Array(Question),
  status: Schema.Literals(["open", "answered", "declined", "unanswered"]),
  answers: Schema.Array(QuestionAnswer),
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

export const TaskItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("task"),
  taskId: Schema.String,
  toolCallId: Schema.String,
  kind: TaskKind,
  description: Schema.String,
  status: Schema.Literals(["running", "completed", "failed", "stopped"]),
  summary: Schema.NullOr(Schema.String),
  output: Schema.NullOr(Schema.String),
})

export const WorkingFolderItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("working_folder"),
  ...workingFolderFields,
})

export const RunOptionItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("run_option"),
  ...runOptionFields,
})

export const TaskStopItem = Schema.Struct({
  ...itemFields,
  type: Schema.Literal("task_stop"),
  ...taskStopFields,
})

export const TranscriptItem = Schema.Union([
  MessageItem,
  ThinkingItem,
  ToolCallItem,
  ApprovalItem,
  QuestionItem,
  UsageItem,
  ErrorItem,
  InterruptionItem,
  TaskItem,
  WorkingFolderItem,
  RunOptionItem,
  TaskStopItem,
])
export type TranscriptItem = typeof TranscriptItem.Type

export const TranscriptPage = Schema.Struct({
  items: Schema.Array(TranscriptItem),
  hasBefore: Schema.Boolean,
  hasAfter: Schema.Boolean,
})
export type TranscriptPage = typeof TranscriptPage.Type

// The sum of the session's `usage` items; null while it has none.
export const SessionUsage = Schema.NullOr(
  Schema.Struct({ tokens: Schema.Int, costUsd: Schema.Number }),
)
export type SessionUsage = typeof SessionUsage.Type

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
  // First element: the session's usage so far; then its new total after each `usage` item.
  Rpc.make("transcript.watchUsage", {
    payload: { sessionId: Schema.String },
    success: SessionUsage,
    stream: true,
  }),
  // The steps of the background subagent started by tool call `toolCallId`, in order.
  Rpc.make("transcript.getTaskItems", {
    payload: { sessionId: Schema.String, toolCallId: Schema.String },
    success: Schema.Array(TranscriptItem),
  }),
  // Every image the user sent in the session, in transcript order.
  Rpc.make("transcript.listImages", {
    payload: { sessionId: Schema.String },
    success: Schema.Array(SessionImage),
  }),
  // The images not deleted that the selection takes, and the size of their files.
  Rpc.make("transcript.getImageSpace", {
    payload: ImageSelection,
    success: ImageSpace,
  }),
  // Returns what it freed.
  Rpc.make("transcript.deleteImages", {
    payload: ImageSelection,
    success: DeletedImages,
  }),
)
