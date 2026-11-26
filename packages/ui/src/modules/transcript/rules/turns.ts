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
      // Drawn in this row, so the turn ending adds no row.
      readonly answerIds: ReadonlyArray<string>
    }

// A subagent's steps show in its task's sheet; the server's page leaves them out too.
export const isSubagentStep = (item: TranscriptItem) =>
  "parentToolCallId" in item && item.parentToolCallId !== undefined

const isSteer = (item: TranscriptItem) =>
  item.type === "message" && item.role === "user" && item.steer
const isWork = (item: TranscriptItem) =>
  item.type === "tool_call" || item.type === "approval" || isSteer(item)
const isUserMessage = (item: TranscriptItem) =>
  item.type === "message" && item.role === "user" && !item.steer

// Items before the first user message are a turn cut by paging.
// The last turn gets a work row before its first tool call, for the line that says the agent works.
export const transcriptRows = (all: ReadonlyArray<TranscriptItem>): TranscriptRow[] => {
  const rows: TranscriptRow[] = []
  const turns: TranscriptItem[][] = []
  // The agent's questions show in place of the tool call that asked them.
  const asked = new Set(all.flatMap((item) => (item.type === "question" ? [item.toolCallId] : [])))
  // A task shows in the fold, not in the turns.
  const items = all.filter(
    (item) =>
      item.type !== "task" &&
      !isSubagentStep(item) &&
      (item.type !== "tool_call" || !asked.has(item.toolCallId)),
  )
  for (const item of items) {
    if (isUserMessage(item) || turns.length === 0) turns.push([item])
    else turns.at(-1)!.push(item)
  }
  turns.forEach((turn) => {
    const user = isUserMessage(turn[0]!) ? turn[0]! : null
    const rest = user ? turn.slice(1) : turn
    if (user) rows.push({ type: "item", id: user.id })
    const lastWork = rest.findLastIndex(isWork)
    const answer = rest.slice(lastWork + 1).filter((item) => item.type !== "usage")
    if (lastWork >= 0 || user) {
      rows.push({
        type: "work",
        id: `work:${turn[0]!.id}`,
        itemIds: rest.slice(0, lastWork + 1).map((item) => item.id),
        turnIds: turn.map((item) => item.id),
        answerIds: answer.map((item) => item.id),
      })
    } else {
      for (const item of answer) rows.push({ type: "item", id: item.id })
    }
  })
  return rows
}

const runningTurnRows = (rows: ReadonlyArray<TranscriptRow>): ReadonlyArray<TranscriptRow> => {
  const index = rows.findLastIndex((row) => row.type === "work")
  const work = rows[index]
  if (work?.type !== "work") return rows
  return [
    ...rows.slice(0, index),
    { ...work, itemIds: [...work.itemIds, ...work.answerIds], answerIds: [] },
    ...rows.slice(index + 1),
  ]
}

export const shownRows = (rows: ReadonlyArray<TranscriptRow>, live: boolean) =>
  live
    ? runningTurnRows(rows)
    : rows.filter((row) => row.type === "item" || row.itemIds.length + row.answerIds.length > 0)

// A turn cut by paging starts with an item folded into its work row, so it has no message row.
export const lastTurnMessageId = (rows: ReadonlyArray<TranscriptRow>): string | undefined => {
  const work = rows.findLast((row) => row.type === "work")
  const first = work?.type === "work" ? work.turnIds[0] : undefined
  return first !== undefined && rows.some((row) => row.type === "item" && row.id === first)
    ? first
    : undefined
}

export interface Step {
  readonly id: string
  readonly steer: MessageItem | null
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
}

const isAssistantText = (item: TranscriptItem): item is MessageItem =>
  item.type === "message" && item.role === "assistant"

export const turnWork = (
  id: string,
  work: ReadonlyArray<TranscriptItem>,
  turn: ReadonlyArray<TranscriptItem>,
): TurnWork => {
  const steps: Array<{
    id: string
    steer: MessageItem | null
    sentence: MessageItem | null
    children: TranscriptItem[]
  }> = []
  for (const item of work) {
    const last = steps.at(-1)
    if (item.type === "message" && isSteer(item))
      steps.push({ id: item.id, steer: item, sentence: null, children: [] })
    else if (isAssistantText(item) && last?.steer && !last.sentence && last.children.length === 0)
      last.sentence = item
    else if (isAssistantText(item))
      steps.push({ id: item.id, steer: null, sentence: item, children: [] })
    else {
      if (steps.length === 0)
        steps.push({ id: `${id}:start`, steer: null, sentence: null, children: [] })
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
  return {
    steps: built,
    calls: calls.length,
    failed: built.reduce((sum, step) => sum + step.failed, 0),
    startAt: turn[0]?.at ?? 0,
    endAt: Math.max(0, ...turn.map((item) => item.at)),
    outcome,
  }
}

export const OPEN_STEPS_UP_TO = 8

export const stepOpenByDefault = (work: TurnWork, index: number, live: boolean) =>
  live ? index === work.steps.length - 1 : work.calls <= OPEN_STEPS_UP_TO

export const SHOWN_STEPS_WHILE_LIVE = 3
export const SHOWN_CALLS_WHILE_LIVE = 8

export const earlierSteps = (work: TurnWork, live: boolean): ReadonlyArray<Step> =>
  live ? work.steps.slice(0, Math.max(0, work.steps.length - SHOWN_STEPS_WHILE_LIVE)) : []

export const earlierStepsKey = (rowId: string) => `${rowId}:earlier`

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
  live || work.outcome !== "answered"

export const duration = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
}
