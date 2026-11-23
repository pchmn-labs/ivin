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
  "| # | File | What changed | Why |",
  "|---|---|---|---|",
  "| 1 | `list.tsx` | `orders` defaults to an empty array | The first render happens before the page arrives, with no orders yet |",
  "| 2 | `list.test.ts` | A test renders an empty page | The crash only showed on a fresh account, where the first page is empty |",
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

const demoQuestions = [
  {
    question: "Which test runner should the new tests use?",
    header: "Runner",
    options: [
      { label: "Vitest", description: "Already set up in the workspace." },
      { label: "Node's test runner", description: "No dependency, fewer features." },
    ],
    multiSelect: false,
  },
  {
    question: "Which folders should the tests cover?",
    header: "Folders",
    options: [
      { label: "src/orders", description: "Order intake and pricing." },
      { label: "src/billing", description: "Invoices and refunds." },
      { label: "src/shipping", description: "Labels and tracking." },
    ],
    multiSelect: true,
  },
]

export const demoQuestionTurn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "assistant_text", text: "A couple of questions before I write the tests.", raw: null },
  {
    type: "tool_call",
    toolCallId: "demo-tool-question",
    name: "AskUserQuestion",
    input: { questions: demoQuestions },
    raw: null,
  },
  {
    type: "question_request",
    requestId: "demo-question-1",
    toolCallId: "demo-tool-question",
    questions: demoQuestions,
    raw: null,
  },
  {
    type: "tool_result",
    toolCallId: "demo-tool-question",
    output: "The user answered.",
    isError: false,
    raw: null,
  },
  { type: "assistant_text", text: "Thanks, I'll write them that way.", raw: null },
  { type: "status", status: "idle", raw: null },
]

export const demoQuestionScript: readonly (readonly HarnessOutput[])[] = [
  demoTurn,
  demoQuestionTurn,
]

// Streams its answer around an approval, for the sent message's place while the sheet opens and closes.
const demoTypecheckTurn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "delta", kind: "assistant_text", text: "I'll run the type checker " },
  { type: "delta", kind: "assistant_text", text: "over the orders folder." },
  { type: "assistant_text", text: "I'll run the type checker over the orders folder.", raw: null },
  {
    type: "tool_call",
    toolCallId: "demo-typecheck",
    name: "Bash",
    input: { command: "pnpm tsc --noEmit -p src/orders" },
    raw: null,
  },
  {
    type: "approval_request",
    requestId: "demo-approval-typecheck",
    toolCallId: "demo-typecheck",
    name: "Bash",
    input: { command: "pnpm tsc --noEmit -p src/orders" },
    raw: null,
  },
  {
    type: "tool_result",
    toolCallId: "demo-typecheck",
    output: "No errors",
    isError: false,
    raw: null,
  },
  { type: "delta", kind: "assistant_text", text: "The orders folder " },
  { type: "delta", kind: "assistant_text", text: "type checks with no error." },
  { type: "assistant_text", text: "The orders folder type checks with no error.", raw: null },
  { type: "usage", ...demoUsage, raw: null },
  { type: "status", status: "idle", raw: null },
]

// Reads the message sent while it waits on the approval, then waits on a second one.
const demoSteerTurn: readonly ScriptedElement[] = [
  ...demoApprovalTurn.slice(0, demoApprovalTurn.findIndex((o) => o.type === "tool_result") + 1),
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
  demoQuestionTurn,
  demoTypecheckTurn,
  demoSteerTurn,
]
