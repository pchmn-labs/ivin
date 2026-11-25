#!/usr/bin/env node
// Speaks just enough of claude's stream-json: echoes each user message and works until interrupted.
// A message starting with "run: " runs the rest in a shell and answers with what it printed.
const { execSync } = require("node:child_process")
const { createInterface } = require("node:readline")

// A one-shot run (a title) gets no answer: leaving at once saves its 30 s timeout.
if (!process.argv.includes("--input-format")) process.exit(1)

const sessionId = "00000000-0000-4000-8000-000000000001"
const emit = (line) =>
  process.stdout.write(`${JSON.stringify({ session_id: sessionId, ...line })}\n`)
const streamEvent = (event) => emit({ type: "stream_event", event, parent_tool_use_id: null })

let turn = 0
const answer = (text) => {
  turn += 1
  const id = `msg_fake${turn}`
  emit({ type: "system", subtype: "status", status: "requesting" })
  streamEvent({
    type: "message_start",
    message: { id, type: "message", role: "assistant", content: [] },
  })
  streamEvent({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })
  streamEvent({
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text: `echo: ${text}` },
  })
  emit({
    type: "assistant",
    message: {
      id,
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: `echo: ${text}` }],
    },
    parent_tool_use_id: null,
  })
}

const interrupt = (requestId) => {
  emit({
    type: "control_response",
    response: { subtype: "success", request_id: requestId, response: { still_queued: [] } },
  })
  emit({
    type: "user",
    message: { role: "user", content: [{ type: "text", text: "[Request interrupted by user]" }] },
    parent_tool_use_id: null,
  })
  streamEvent({ type: "content_block_stop", index: 0 })
  streamEvent({ type: "message_stop" })
  emit({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "",
    total_cost_usd: 0,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    terminal_reason: "aborted_streaming",
  })
}

createInterface({ input: process.stdin }).on("line", (text) => {
  let line
  try {
    line = JSON.parse(text)
  } catch {
    return
  }
  if (line.type === "user") {
    const block = line.message.content.find((part) => part.type === "text")
    const text = block ? block.text : ""
    answer(
      text.startsWith("run: ")
        ? execSync(`${text.slice(5)} 2>&1`, { encoding: "utf8", shell: "/bin/sh" })
        : text,
    )
  } else if (line.type === "control_request" && line.request?.subtype === "initialize") {
    // An empty list is what ivin falls back on after waiting 10 s for no answer.
    emit({
      type: "control_response",
      response: { subtype: "success", request_id: line.request_id, response: { models: [] } },
    })
  } else if (line.type === "control_request" && line.request?.subtype === "interrupt") {
    interrupt(line.request_id)
  }
})

// Survives closed pipes, so only a signal stops it.
process.stdout.on("error", () => {})
setInterval(() => {}, 1 << 30)
