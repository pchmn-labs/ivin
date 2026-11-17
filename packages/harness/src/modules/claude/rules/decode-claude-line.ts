import type { HarnessEvent, HarnessOutput } from "@ivin/contracts/transcript"
import * as Schema from "effect/Schema"

const Envelope = Schema.Struct({
  type: Schema.String,
  subtype: Schema.optional(Schema.String),
  parent_tool_use_id: Schema.optional(Schema.NullOr(Schema.String)),
})

const SystemInitLine = Schema.Struct({ session_id: Schema.String })

const SystemStatusLine = Schema.Struct({ status: Schema.NullOr(Schema.String) })

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

const fromAssistant = (line: unknown): HarnessOutput[] => {
  const decoded = Schema.decodeUnknownSync(AssistantLine)(line)
  // A synthetic API error message; the closing result line reports it.
  if (decoded.error !== undefined) return []
  return decoded.message.content.filter(isBlock).flatMap((block): HarnessEvent[] => {
    if (block.type === "text") {
      return block.text === "" ? [] : [{ type: "assistant_text", text: block.text, raw: block }]
    }
    if (block.type === "thinking") {
      return block.thinking === "" ? [] : [{ type: "thinking", text: block.thinking, raw: block }]
    }
    return [
      { type: "tool_call", toolCallId: block.id, name: block.name, input: block.input, raw: block },
    ]
  })
}

const INTERRUPTION_TEXT = "[Request interrupted by user"

const fromUser = (line: unknown): HarnessOutput[] => {
  const { message } = Schema.decodeUnknownSync(UserLine)(line)
  if (typeof message.content === "string") return []
  return message.content.flatMap((block): HarnessOutput[] => {
    if (isToolResultBlock(block)) {
      return [
        {
          type: "tool_result",
          toolCallId: block.tool_use_id,
          output: toolResultOutput(block.content),
          isError: block.is_error ?? false,
          raw: block,
        },
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
  if (subtype !== "status") return []
  const { status } = Schema.decodeUnknownSync(SystemStatusLine)(line)
  return status === "requesting" ? [{ type: "status", status: "running", raw: line }] : []
}

const fromControlRequest = (line: unknown): HarnessOutput[] => {
  const { request_id, request } = Schema.decodeUnknownSync(ControlRequestLine)(line)
  if (request.subtype !== "can_use_tool" || request.tool_name === undefined) return []
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

export const decodeClaudeLine = (text: string): HarnessOutput[] => {
  let line: unknown
  try {
    line = JSON.parse(text)
  } catch {
    return []
  }
  try {
    const { type, subtype, parent_tool_use_id } = Schema.decodeUnknownSync(Envelope)(line)
    if (parent_tool_use_id) return []
    switch (type) {
      case "stream_event":
        return fromStreamEvent(line)
      case "assistant":
        return fromAssistant(line)
      case "user":
        return fromUser(line)
      case "result":
        return fromResult(line, subtype)
      case "control_request":
        return fromControlRequest(line)
      case "system":
        return fromSystem(line, subtype)
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
