import type { HarnessEvent } from "@ivin/contracts/transcript"

export const demoAnswer = "The scripted answer: this project has 3 files and every test passes."

export const demoUsage = { inputTokens: 1200, outputTokens: 340, costUsd: 0.0123 }

export const demoTurn: readonly HarnessEvent[] = [
  { type: "status", status: "running", raw: null },
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
  { type: "assistant_text", text: demoAnswer, raw: null },
  { type: "usage", ...demoUsage, raw: null },
  { type: "status", status: "idle", raw: null },
]

export const demoScript: readonly (readonly HarnessEvent[])[] = [demoTurn]
