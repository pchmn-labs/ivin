import type { HarnessOutput } from "@ivin/contracts/transcript"

export const demoAnswer = "The scripted answer: this project has 3 files and every test passes."

export const demoUsage = {
  inputTokens: 1200,
  outputTokens: 340,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0.0123,
}

export const demoTurn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "delta", kind: "assistant_text", text: "Let me look at " },
  { type: "delta", kind: "assistant_text", text: "the project first." },
  { type: "assistant_text", text: "Let me look at the project first.", raw: null },
  {
    type: "tool_call",
    toolCallId: "demo-tool-1",
    name: "list_files",
    input: { path: "." },
    raw: null,
  },
  {
    type: "tool_result",
    toolCallId: "demo-tool-1",
    output: "package.json\nREADME.md\nsrc/index.ts",
    isError: false,
    raw: null,
  },
  { type: "delta", kind: "assistant_text", text: "The scripted answer: this project has 3 files" },
  { type: "delta", kind: "assistant_text", text: " and every test passes." },
  { type: "assistant_text", text: demoAnswer, raw: null },
  { type: "usage", ...demoUsage, raw: null },
  { type: "status", status: "idle", raw: null },
]

export const demoScript: readonly (readonly HarnessOutput[])[] = [demoTurn]

export const demoApprovalTurn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "assistant_text", text: "I need to run the tests to check.", raw: null },
  {
    type: "tool_call",
    toolCallId: "demo-tool-2",
    name: "Bash",
    input: { command: "pnpm test" },
    raw: null,
  },
  {
    type: "approval_request",
    requestId: "demo-approval-1",
    toolCallId: "demo-tool-2",
    name: "Bash",
    input: { command: "pnpm test" },
    raw: null,
  },
  {
    type: "tool_result",
    toolCallId: "demo-tool-2",
    output: "3 files, all passed",
    isError: false,
    raw: null,
  },
  { type: "assistant_text", text: "The tests pass.", raw: null },
  { type: "status", status: "idle", raw: null },
]

// A first turn that answers, then a second that waits for an approval.
export const demoApprovalScript: readonly (readonly HarnessOutput[])[] = [
  demoTurn,
  demoApprovalTurn,
]
