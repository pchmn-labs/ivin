import { expect, test } from "vitest"
import {
  claudeRecordingArgs,
  matches,
  parseRecording,
  permissionAnswer,
  redactLine,
} from "./recording.ts"

const parsed = (...argv: string[]) => {
  const result = parseRecording(argv)
  if (typeof result === "string") throw new Error(result)
  return result
}

test("a bare fixture name records one cheap, tool-less run that ends at the result", () => {
  expect(parsed("plain-answer", "--send", "hi")).toEqual({
    name: "plain-answer",
    steps: [{ wait: null, action: { type: "send", text: "hi" } }],
    until: { type: "result", subtype: null },
    keep: [],
    allow: [],
    deny: [],
    model: "haiku",
    effort: "low",
    permissionMode: "manual",
    maxTurns: 4,
    timeoutMs: 120_000,
  })
})

test("a wait applies to the step that follows it, as a delay or a line to see", () => {
  expect(
    parsed(
      "interruption",
      "--send",
      "Write a long story",
      "--wait",
      "stream_event/content_block_delta",
      "--interrupt",
      "--wait",
      "500ms",
      "--send",
      "Go on",
    ).steps,
  ).toEqual([
    { wait: null, action: { type: "send", text: "Write a long story" } },
    {
      wait: { type: "stream_event", subtype: "content_block_delta" },
      action: { type: "interrupt" },
    },
    { wait: { ms: 500 }, action: { type: "send", text: "Go on" } },
  ])
})

test("an initialize step can end the run at its answer and keep only that line", () => {
  const recording = parsed(
    "initialize",
    "--initialize",
    "--until",
    "control_response",
    "--keep",
    "control_response",
  )
  expect(recording.steps).toEqual([{ wait: null, action: { type: "initialize" } }])
  expect(recording.until).toEqual({ type: "control_response", subtype: null })
  expect(recording.keep).toEqual([{ type: "control_response", subtype: null }])
})

test.each([
  [["--send", "hi"], /fixture name/],
  [["../escape", "--send", "hi"], /fixture name/],
  [["name"], /at least one step/],
  [["name", "--send", "hi", "--permission-mode", "bypassPermissions"], /bypassPermissions/],
  [["name", "--send", "hi", "--permission-mode", "acceptEdits"], /acceptEdits/],
  [["name", "--send", "hi", "--permission-mode", "auto"], /auto/],
  [["name", "--send", "hi", "--dangerously-skip-permissions"], /Unknown option/],
  [["name", "--send", "hi", "--wait", "10ms"], /--wait must come before a step/],
  [["name", "--send", "hi", "--max-turns", "0"], /--max-turns/],
  [["name", "--send"], /--send needs a value/],
])("%j is refused", (argv, message) => {
  expect(parseRecording(argv)).toMatch(message)
})

test("Claude Code gets the harness's arguments, only the allowed and denied tools, and no user settings", () => {
  const args = claudeRecordingArgs(
    parsed("x", "--send", "hi", "--allow", "Bash", "--deny", "Write", "--model", "sonnet"),
  )

  expect(args.slice(0, 12)).toEqual([
    "-p",
    "--output-format",
    "stream-json",
    "--input-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--thinking-display",
    "summarized",
    "--permission-prompt-tool",
    "stdio",
    "--model",
  ])
  expect(args).toContain("sonnet")
  expect(args.join(" ")).toContain("--permission-mode manual")
  expect(args.join(" ")).toContain("--tools Bash,Write")
  expect(args.join(" ")).toContain("--max-turns 4")
  expect(args.join(" ")).toContain("--setting-sources project,local")
  expect(args).toContain("--strict-mcp-config")
  expect(args).not.toContain("bypassPermissions")
})

test("with no tool allowed or denied, Claude Code gets no tool at all", () => {
  const args = claudeRecordingArgs(parsed("x", "--send", "hi"))
  expect(args[args.indexOf("--tools") + 1]).toBe("")
})

test("a trigger matches a line's type, and its subtype, stream event type or request subtype", () => {
  const delta = { type: "stream_event", event: { type: "content_block_delta" } }
  const ask = { type: "control_request", request: { subtype: "can_use_tool" } }

  expect(matches({ type: "stream_event", subtype: null }, delta)).toBe(true)
  expect(matches({ type: "stream_event", subtype: "content_block_delta" }, delta)).toBe(true)
  expect(matches({ type: "stream_event", subtype: "message_stop" }, delta)).toBe(false)
  expect(matches({ type: "system", subtype: "init" }, { type: "system", subtype: "init" })).toBe(
    true,
  )
  expect(matches({ type: "control_request", subtype: "can_use_tool" }, ask)).toBe(true)
  expect(matches({ type: "result", subtype: null }, "not an object")).toBe(false)
})

test("a permission request is allowed for an allowed tool and denied for any other", () => {
  const recording = parsed("x", "--send", "hi", "--allow", "Bash", "--deny", "Write")
  const request = (tool: string) => ({
    type: "control_request",
    request_id: "r1",
    request: { subtype: "can_use_tool", tool_name: tool, input: { command: "ls" } },
  })

  expect(JSON.parse(permissionAnswer(recording, request("Bash"))!)).toMatchObject({
    response: {
      request_id: "r1",
      response: { behavior: "allow", updatedInput: { command: "ls" } },
    },
  })
  expect(JSON.parse(permissionAnswer(recording, request("Write"))!)).toMatchObject({
    response: { request_id: "r1", response: { behavior: "deny" } },
  })
  expect(JSON.parse(permissionAnswer(recording, request("Read"))!)).toMatchObject({
    response: { response: { behavior: "deny" } },
  })
  expect(permissionAnswer(recording, { type: "assistant" })).toBeUndefined()
})

test("a permission request without an id gets no answer", () => {
  const recording = parsed("x", "--send", "hi", "--allow", "Bash")
  const request = {
    type: "control_request",
    request: { subtype: "can_use_tool", tool_name: "Bash" },
  }

  expect(permissionAnswer(recording, request)).toBeUndefined()
})

test("the account's email and organization, and the home folder, never reach a fixture", () => {
  const line = JSON.stringify({
    type: "control_response",
    response: {
      response: {
        account: {
          email: "someone@company.com",
          organization: "company",
          apiProvider: "firstParty",
        },
        user_output_styles_dir: "/Users/someone/.claude/output-styles",
      },
    },
  })

  const redacted = redactLine(line, "/Users/someone")

  expect(redacted).not.toMatch(/someone|company/)
  expect(JSON.parse(redacted)).toMatchObject({
    response: {
      response: {
        account: { email: "user@example.com", organization: "example", apiProvider: "firstParty" },
        user_output_styles_dir: "~/.claude/output-styles",
      },
    },
  })
})

test("a line with nothing to redact is kept byte for byte", () => {
  const line = '{"type":"assistant","text":"Opus 5.5 \\u00b7 Best"}'
  expect(redactLine(line, "/Users/someone")).toBe(line)
  expect(redactLine("not json", "/Users/someone")).toBe("not json")
})
