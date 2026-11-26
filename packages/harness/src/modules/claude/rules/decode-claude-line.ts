import type { HarnessEvent, HarnessOutput } from "@ivin/contracts/transcript"
import * as Schema from "effect/Schema"

const Envelope = Schema.Struct({
  type: Schema.String,
  subtype: Schema.optional(Schema.String),
  parent_tool_use_id: Schema.optional(Schema.NullOr(Schema.String)),
})

const SystemInitLine = Schema.Struct({ session_id: Schema.String })

const SystemStatusLine = Schema.Struct({ status: Schema.NullOr(Schema.String) })

const TaskStartedLine = Schema.Struct({
  task_id: Schema.String,
  tool_use_id: Schema.String,
  description: Schema.String,
  task_type: Schema.String,
  prompt: Schema.optional(Schema.String),
  is_backgrounded: Schema.optional(Schema.Boolean),
})

const TaskNotificationLine = Schema.Struct({
  task_id: Schema.String,
  status: Schema.String,
  summary: Schema.optional(Schema.String),
})

const StreamEventLine = Schema.Struct({
  event: Schema.Struct({
    type: Schema.String,
    delta: Schema.optional(
      Schema.Struct({
        type: Schema.optional(Schema.String),
        text: Schema.optional(Schema.String),
        thinking: Schema.optional(Schema.String),
      }),
    ),
  }),
})

const TextBlock = Schema.Struct({ type: Schema.Literal("text"), text: Schema.String })
const ThinkingBlock = Schema.Struct({ type: Schema.Literal("thinking"), thinking: Schema.String })
const ToolUseBlock = Schema.Struct({
  type: Schema.Literal("tool_use"),
  id: Schema.String,
  name: Schema.String,
  input: Schema.Unknown,
})
const AssistantBlock = Schema.Union([TextBlock, ThinkingBlock, ToolUseBlock])

const AssistantLine = Schema.Struct({
  error: Schema.optional(Schema.Unknown),
  message: Schema.Struct({ content: Schema.Array(Schema.Unknown) }),
})

const ToolResultBlock = Schema.Struct({
  type: Schema.Literal("tool_result"),
  tool_use_id: Schema.String,
  content: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.Unknown)])),
  is_error: Schema.optional(Schema.Boolean),
})

const UserLine = Schema.Struct({
  message: Schema.Struct({
    content: Schema.Union([Schema.String, Schema.Array(Schema.Unknown)]),
  }),
})

const ResultLine = Schema.Struct({
  is_error: Schema.Boolean,
  terminal_reason: Schema.optional(Schema.String),
  result: Schema.optional(Schema.String),
  errors: Schema.optional(Schema.Array(Schema.String)),
  total_cost_usd: Schema.optional(Schema.NullOr(Schema.Number)),
  usage: Schema.optional(
    Schema.Struct({
      input_tokens: Schema.optional(Schema.Int),
      output_tokens: Schema.optional(Schema.Int),
      cache_read_input_tokens: Schema.optional(Schema.Int),
      cache_creation_input_tokens: Schema.optional(Schema.Int),
    }),
  ),
})

const ControlRequestLine = Schema.Struct({
  request_id: Schema.String,
  request: Schema.Struct({
    subtype: Schema.String,
    tool_name: Schema.optional(Schema.String),
    input: Schema.optional(Schema.Unknown),
    tool_use_id: Schema.optional(Schema.String),
  }),
})

const CommandLifecycleLine = Schema.Struct({ command_uuid: Schema.String, state: Schema.String })

const isHandback = Schema.is(Schema.Struct({ message: Schema.NonEmptyString }))
const isBlock = Schema.is(AssistantBlock)
const isToolResultBlock = Schema.is(ToolResultBlock)
const isTextBlock = Schema.is(TextBlock)

const toolResultOutput = (content: string | readonly unknown[] | undefined): string => {
  if (content === undefined) return ""
  if (typeof content === "string") return content
  return content
    .map((block) => (isTextBlock(block) ? block.text : JSON.stringify(block)))
    .join("\n")
}

const fromStreamEvent = (line: unknown): HarnessOutput[] => {
  const { event } = Schema.decodeUnknownSync(StreamEventLine)(line)
  if (event.type !== "content_block_delta" || !event.delta) return []
  const { delta } = event
  if (delta.type === "text_delta" && delta.text)
    return [{ type: "delta", kind: "assistant_text", text: delta.text }]
  if (delta.type === "thinking_delta" && delta.thinking)
    return [{ type: "delta", kind: "thinking", text: delta.thinking }]
  return []
}

const fromAssistant = (line: unknown, parent: string | null): HarnessOutput[] => {
  const under = parent ? { parentToolCallId: parent } : {}
  const decoded = Schema.decodeUnknownSync(AssistantLine)(line)
  // A synthetic API error message; the closing result line reports it.
  if (decoded.error !== undefined) return []
  return decoded.message.content.filter(isBlock).flatMap((block): HarnessEvent[] => {
    if (block.type === "text") {
      return block.text === ""
        ? []
        : [{ type: "assistant_text", text: block.text, ...under, raw: block }]
    }
    if (block.type === "thinking") {
      return block.thinking === ""
        ? []
        : [{ type: "thinking", text: block.thinking, ...under, raw: block }]
    }
    // A subagent reports back through this call; its message reads as the agent's words.
    if (parent && block.name === "SubagentHandback" && isHandback(block.input))
      return [{ type: "assistant_text", text: block.input.message, ...under, raw: block }]
    return [
      {
        type: "tool_call",
        toolCallId: block.id,
        name: block.name,
        input: block.input,
        ...under,
        raw: block,
      },
    ]
  })
}

const INTERRUPTION_TEXT = "[Request interrupted by user"

// The result of a call whose subagent reported through SubagentHandback only points to that report.
const HANDBACK_POINTER = "(its SubagentHandback call)"

// The result of a call that started a background task says where the task writes its output.
const TASK_OUTPUT_FILE = /(\/\S*\/tasks\/([^/\s]+)\.output)/

const taskOutputFile = (output: string): HarnessOutput[] => {
  if (!output.includes("Output is being written to:") && !output.includes("output_file:")) return []
  const found = TASK_OUTPUT_FILE.exec(output)
  return found ? [{ type: "task_output_file", taskId: found[2]!, path: found[1]! }] : []
}

const fromUser = (line: unknown, parent: string | null): HarnessOutput[] => {
  const { message } = Schema.decodeUnknownSync(UserLine)(line)
  if (typeof message.content === "string") return []
  return message.content.flatMap((block): HarnessOutput[] => {
    if (isToolResultBlock(block)) {
      const output = toolResultOutput(block.content)
      return [
        {
          type: "tool_result",
          toolCallId: block.tool_use_id,
          output: output.includes(HANDBACK_POINTER) ? "" : output,
          isError: block.is_error ?? false,
          ...(parent ? { parentToolCallId: parent } : {}),
          raw: block,
        },
        ...taskOutputFile(output),
      ]
    }
    return isTextBlock(block) && block.text.startsWith(INTERRUPTION_TEXT)
      ? [{ type: "interruption", raw: line }]
      : []
  })
}

const fromResult = (line: unknown, subtype: string | undefined): HarnessOutput[] => {
  const result = Schema.decodeUnknownSync(ResultLine)(line)
  // The interruption was already reported from the user line; the aborted result is not a failure.
  const aborted = result.terminal_reason?.startsWith("aborted_") ?? false
  const failed = !aborted && (result.is_error || (subtype !== undefined && subtype !== "success"))
  const message = result.result || result.errors?.join("\n") || subtype || "The run failed"
  const usage = result.usage
  return [
    ...(failed ? [{ type: "error", message, raw: line } as const] : []),
    {
      type: "usage",
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
      costUsd: result.total_cost_usd ?? null,
      raw: line,
    },
    { type: "status", status: "idle", raw: line },
  ]
}

const fromSystem = (line: unknown, subtype: string | undefined): HarnessOutput[] => {
  if (subtype === "init") {
    const { session_id } = Schema.decodeUnknownSync(SystemInitLine)(line)
    return [{ type: "provider_session", providerSessionId: session_id }]
  }
  if (subtype === "task_started") return fromTaskStarted(line)
  if (subtype === "task_notification") return fromTaskNotification(line)
  if (subtype !== "status") return []
  const { status } = Schema.decodeUnknownSync(SystemStatusLine)(line)
  return status === "requesting" ? [{ type: "status", status: "running", raw: line }] : []
}

// A task that was not started in the background, such as a subagent the turn waits for, is no task here.
const fromTaskStarted = (line: unknown): HarnessOutput[] => {
  const started = Schema.decodeUnknownSync(TaskStartedLine)(line)
  if (started.is_backgrounded !== true) return []
  return [
    {
      type: "task_started",
      taskId: started.task_id,
      toolCallId: started.tool_use_id,
      kind: started.task_type === "local_bash" ? "command" : "agent",
      description: started.description,
      ...(started.prompt ? { prompt: started.prompt } : {}),
      raw: line,
    },
  ]
}

const taskOutcome = (status: string): "completed" | "failed" | "stopped" =>
  status === "completed"
    ? "completed"
    : status === "stopped" || status === "killed"
      ? "stopped"
      : "failed"

const fromTaskNotification = (line: unknown): HarnessOutput[] => {
  const ended = Schema.decodeUnknownSync(TaskNotificationLine)(line)
  return [
    {
      type: "task_ended",
      taskId: ended.task_id,
      outcome: taskOutcome(ended.status),
      summary: ended.summary ?? "",
      output: null,
      raw: line,
    },
  ]
}

// The tool input of a `question_request`, which the response must send back with the answers.
export const controlRequestInput = (raw: unknown): unknown =>
  Schema.decodeUnknownSync(ControlRequestLine)(raw).request.input

const QuestionsInput = Schema.Struct({
  questions: Schema.Array(
    Schema.Struct({
      question: Schema.String,
      header: Schema.String,
      options: Schema.Array(Schema.Struct({ label: Schema.String, description: Schema.String })),
      multiSelect: Schema.Boolean,
    }),
  ),
})
const isQuestionsInput = Schema.is(QuestionsInput)

const fromControlRequest = (line: unknown): HarnessOutput[] => {
  const { request_id, request } = Schema.decodeUnknownSync(ControlRequestLine)(line)
  if (request.subtype !== "can_use_tool" || request.tool_name === undefined) return []
  if (request.tool_name === "AskUserQuestion" && isQuestionsInput(request.input))
    return [
      {
        type: "question_request",
        requestId: request_id,
        toolCallId: request.tool_use_id ?? null,
        questions: request.input.questions.map(({ question, header, options, multiSelect }) => ({
          question,
          header,
          options: options.map(({ label, description }) => ({ label, description })),
          multiSelect,
        })),
        raw: line,
      },
    ]
  return [
    {
      type: "approval_request",
      requestId: request_id,
      toolCallId: request.tool_use_id ?? null,
      name: request.tool_name,
      input: request.input,
      raw: line,
    },
  ]
}

// Claude Code queues a message sent mid-turn and starts it after the next tool result, or as the next turn.
const fromCommandLifecycle = (line: unknown): HarnessOutput[] => {
  const { command_uuid, state } = Schema.decodeUnknownSync(CommandLifecycleLine)(line)
  return state === "started" ? [{ type: "message_read", messageId: command_uuid }] : []
}

// Undefined: the line is not JSON.
export const parseClaudeLine = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

export const decodeClaudeLine = (text: string): HarnessOutput[] =>
  decodeParsedLine(parseClaudeLine(text))

export const decodeParsedLine = (line: unknown): HarnessOutput[] => {
  if (line === undefined) return []
  try {
    const { type, subtype, parent_tool_use_id } = Schema.decodeUnknownSync(Envelope)(line)
    // Only the steps of a subagent are kept; its streamed text and other lines are not.
    if (parent_tool_use_id && type !== "assistant" && type !== "user") return []
    switch (type) {
      case "stream_event":
        return fromStreamEvent(line)
      case "assistant":
        return fromAssistant(line, parent_tool_use_id ?? null)
      case "user":
        return fromUser(line, parent_tool_use_id ?? null)
      case "result":
        return fromResult(line, subtype)
      case "control_request":
        return fromControlRequest(line)
      case "system":
        return fromSystem(line, subtype)
      case "command_lifecycle":
        return fromCommandLifecycle(line)
      default:
        return []
    }
  } catch (cause) {
    return [
      {
        type: "error",
        message: `Could not read a line of the claude output: ${String(cause)}`,
        raw: line,
      },
    ]
  }
}
