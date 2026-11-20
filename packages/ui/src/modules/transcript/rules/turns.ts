import type { ToolKind, TranscriptItem } from "@ivin/contracts/transcript"

type MessageItem = Extract<TranscriptItem, { type: "message" }>
type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>

export type TranscriptRow =
  | { readonly type: "item"; readonly id: string }
  | {
      readonly type: "work"
      readonly id: string
      readonly itemIds: ReadonlyArray<string>
      // Every item of the turn, its user message and its answer included, to time it.
      readonly turnIds: ReadonlyArray<string>
    }

const isWork = (item: TranscriptItem) => item.type === "tool_call" || item.type === "approval"
const isUserMessage = (item: TranscriptItem) => item.type === "message" && item.role === "user"

// Items before the first user message are a turn cut by paging.
// The last turn gets a work row before its first tool call, for the line that says the agent works.
export const transcriptRows = (items: ReadonlyArray<TranscriptItem>): TranscriptRow[] => {
  const rows: TranscriptRow[] = []
  const turns: TranscriptItem[][] = []
  for (const item of items) {
    if (isUserMessage(item) || turns.length === 0) turns.push([item])
    else turns.at(-1)!.push(item)
  }
  turns.forEach((turn, index) => {
    const user = isUserMessage(turn[0]!) ? turn[0]! : null
    const rest = user ? turn.slice(1) : turn
    if (user) rows.push({ type: "item", id: user.id })
    const lastWork = rest.findLastIndex(isWork)
    if (lastWork >= 0 || (user && index === turns.length - 1)) {
      rows.push({
        type: "work",
        id: `work:${turn[0]!.id}`,
        itemIds: rest.slice(0, lastWork + 1).map((item) => item.id),
        turnIds: turn.map((item) => item.id),
      })
    }
    for (const item of rest.slice(lastWork + 1)) {
      if (item.type !== "usage") rows.push({ type: "item", id: item.id })
    }
  })
  return rows
}

export interface Step {
  readonly id: string
  // Null for the calls made before the agent wrote anything.
  readonly sentence: MessageItem | null
  readonly children: ReadonlyArray<TranscriptItem>
  readonly calls: ReadonlyArray<ToolCallItem>
  readonly failed: number
}

export type Outcome = "answered" | "stopped" | "failed" | "silent"

export interface TurnWork {
  readonly steps: ReadonlyArray<Step>
  readonly calls: number
  readonly failed: number
  readonly startAt: number
  readonly endAt: number
  readonly outcome: Outcome
  readonly latest:
    | { readonly type: "call"; readonly item: ToolCallItem }
    | { readonly type: "sentence"; readonly item: MessageItem }
    | null
}

const isAssistantText = (item: TranscriptItem): item is MessageItem =>
  item.type === "message" && item.role === "assistant"

export const turnWork = (
  id: string,
  work: ReadonlyArray<TranscriptItem>,
  turn: ReadonlyArray<TranscriptItem>,
): TurnWork => {
  const steps: Array<{ id: string; sentence: MessageItem | null; children: TranscriptItem[] }> = []
  for (const item of work) {
    if (isAssistantText(item)) steps.push({ id: item.id, sentence: item, children: [] })
    else {
      if (steps.length === 0) steps.push({ id: `${id}:start`, sentence: null, children: [] })
      if (item.type !== "thinking" && item.type !== "usage") steps.at(-1)!.children.push(item)
    }
  }
  const built: Step[] = steps.map((step) => {
    const calls = step.children.filter((c): c is ToolCallItem => c.type === "tool_call")
    return { ...step, calls, failed: calls.filter((c) => c.status === "error").length }
  })
  const calls = built.flatMap((step) => step.calls)
  const workIds = new Set(work.map((item) => item.id))
  const after = turn.filter((item) => !workIds.has(item.id))
  const outcome: Outcome = after.some((item) => isAssistantText(item) && item.text !== "")
    ? "answered"
    : turn.some((item) => item.type === "interruption")
      ? "stopped"
      : turn.some((item) => item.type === "error")
        ? "failed"
        : "silent"
  const running = calls.findLast((call) => call.status === "running")
  const current = built.at(-1)
  return {
    steps: built,
    calls: calls.length,
    failed: built.reduce((sum, step) => sum + step.failed, 0),
    startAt: turn[0]?.at ?? 0,
    endAt: Math.max(0, ...turn.map((item) => item.at)),
    outcome,
    latest: running
      ? { type: "call", item: running }
      : current?.sentence
        ? { type: "sentence", item: current.sentence }
        : calls.length > 0
          ? { type: "call", item: calls.at(-1)! }
          : null,
  }
}

export const OPEN_STEPS_UP_TO = 8

export const stepsOpenByDefault = (work: TurnWork) => work.calls <= OPEN_STEPS_UP_TO

export const pinnedCalls = (step: Step) =>
  step.calls.filter((call) => call.status === "error" || call.kind === "agent")

const PHRASES: Record<ToolKind, (count: number) => string> = {
  command: (n) => (n === 1 ? "ran a command" : `ran ${n} commands`),
  read: (n) => `read ${n} ${n === 1 ? "file" : "files"}`,
  edit: (n) => `edited ${n} ${n === 1 ? "file" : "files"}`,
  search: (n) => (n === 1 ? "searched" : `searched ${n} times`),
  skill: (n) => (n === 1 ? "used a skill" : `used ${n} skills`),
  agent: (n) => (n === 1 ? "ran an agent" : `ran ${n} agents`),
  other: (n) => (n === 1 ? "used a tool" : `used ${n} tools`),
}

// "Ran 4 commands", "read 1 file": one phrase per kind, in the order the kinds first appear.
export const callPhrases = (calls: ReadonlyArray<{ readonly kind: ToolKind }>): string[] => {
  const counts = new Map<ToolKind, number>()
  for (const call of calls) counts.set(call.kind, (counts.get(call.kind) ?? 0) + 1)
  return [...counts].map(([kind, count], index) => {
    const phrase = PHRASES[kind](count)
    return index === 0 ? phrase[0]!.toUpperCase() + phrase.slice(1) : phrase
  })
}

export const turnVerb = (outcome: Outcome, live: boolean) =>
  live
    ? "Working for"
    : outcome === "stopped"
      ? "Stopped after"
      : outcome === "failed"
        ? "Failed after"
        : "Worked for"

export const turnOpenByDefault = (work: TurnWork, live: boolean) =>
  !live && work.outcome !== "answered"

export const duration = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
}
