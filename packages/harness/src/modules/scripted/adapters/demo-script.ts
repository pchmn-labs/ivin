import type { HarnessOutput } from "@ivin/contracts/transcript"
import { scriptedRead, type ScriptedElement } from "./scripted-provider.ts"

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

const call = (id: string, name: string, input: unknown, output: string, isError = false) =>
  [
    { type: "tool_call", toolCallId: id, name, input, raw: null },
    { type: "tool_result", toolCallId: id, output, isError, raw: null },
  ] as const

const demoFixAnswer = [
  "Fixed. `OrderList` mapped over `orders` before the first page arrived, so an empty page crashed it.",
  "",
  "- The list now starts from an empty array.",
  "- A test covers the empty page.",
  "",
  "```ts",
  "export function OrderList({ orders = [] }: { orders?: Order[] }) {",
  "  return orders.map((order) => <OrderRow key={order.id} order={order} />)",
  "}",
  "```",
  "",
  "`pnpm test src/orders` passes.",
].join("\n")

// Several steps of tool calls, one failing, then a Markdown answer.
export const demoWorkTurn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "assistant_text", text: "I'll find where the order list reads its page.", raw: null },
  ...call("demo-work-1", "Grep", { pattern: "OrderList" }, "src/orders/list.tsx:18"),
  ...call(
    "demo-work-2",
    "Read",
    { file_path: "src/orders/list.tsx" },
    "export function OrderList…",
  ),
  ...call(
    "demo-work-3",
    "Bash",
    { command: "pnpm test src/orders/list.test.ts" },
    "TypeError: Cannot read properties of undefined (reading 'map')",
    true,
  ),
  {
    type: "assistant_text",
    text: "The list maps over `orders` before the first page arrives. I'm giving it an empty default.",
    raw: null,
  },
  ...call(
    "demo-work-4",
    "Edit",
    { file_path: "src/orders/list.tsx" },
    "Updated src/orders/list.tsx",
  ),
  ...call("demo-work-5", "Bash", { command: "pnpm test src/orders" }, "7 passed"),
  { type: "assistant_text", text: demoFixAnswer, raw: null },
  { type: "usage", ...demoUsage, raw: null },
  { type: "status", status: "idle", raw: null },
]

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

export const demoApprovalScript: readonly (readonly HarnessOutput[])[] = [
  demoTurn,
  demoApprovalTurn,
]

// Reads the message sent while it waits on the approval, then waits on a second one.
const demoSteerTurn: readonly ScriptedElement[] = [
  ...demoApprovalTurn.slice(0, 5),
  scriptedRead,
  { type: "assistant_text", text: "Understood, I'll leave the e2e tests out of it.", raw: null },
  {
    type: "tool_call",
    toolCallId: "demo-tool-3",
    name: "Bash",
    input: { command: "pnpm test src/orders" },
    raw: null,
  },
  {
    type: "approval_request",
    requestId: "demo-approval-2",
    toolCallId: "demo-tool-3",
    name: "Bash",
    input: { command: "pnpm test src/orders" },
    raw: null,
  },
]

export const demoShotScript: readonly (readonly ScriptedElement[])[] = [
  demoTurn,
  demoWorkTurn,
  demoSteerTurn,
]
