import type { TranscriptEvent, TranscriptItem } from "@ivin/contracts/transcript"

type MessageItem = Extract<TranscriptItem, { type: "message" }>
type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>
type ApprovalItem = Extract<TranscriptItem, { type: "approval" }>

export interface ItemState {
  readonly openMessage: MessageItem | null
  readonly openToolCalls: ReadonlyMap<string, ToolCallItem>
  readonly openApprovals: ReadonlyMap<string, ApprovalItem>
}

export const emptyItemState: ItemState = {
  openMessage: null,
  openToolCalls: new Map(),
  openApprovals: new Map(),
}

export const applyEvent = (
  state: ItemState,
  event: TranscriptEvent,
): { readonly state: ItemState; readonly item: TranscriptItem | null } => {
  const base = { id: event.id, sessionId: event.sessionId, position: event.sequence }
  switch (event.type) {
    case "user_message": {
      const item: MessageItem = { ...base, type: "message", role: "user", text: event.text }
      return { state: { ...state, openMessage: null }, item }
    }
    case "assistant_text": {
      const item: MessageItem = state.openMessage
        ? { ...state.openMessage, text: `${state.openMessage.text}\n\n${event.text}` }
        : { ...base, type: "message", role: "assistant", text: event.text }
      return { state: { ...state, openMessage: item }, item }
    }
    case "thinking": {
      const item: TranscriptItem = { ...base, type: "thinking", text: event.text }
      return { state: { ...state, openMessage: null }, item }
    }
    case "tool_call": {
      const item: ToolCallItem = {
        ...base,
        type: "tool_call",
        toolCallId: event.toolCallId,
        name: event.name,
        input: event.input,
        status: "running",
        output: null,
      }
      const openToolCalls = new Map(state.openToolCalls).set(event.toolCallId, item)
      return { state: { ...state, openMessage: null, openToolCalls }, item }
    }
    case "tool_result": {
      const call = state.openToolCalls.get(event.toolCallId)
      if (!call) return { state, item: null }
      const item: ToolCallItem = {
        ...call,
        status: event.isError ? "error" : "done",
        output: event.output,
      }
      const openToolCalls = new Map(state.openToolCalls)
      openToolCalls.delete(event.toolCallId)
      return { state: { ...state, openToolCalls }, item }
    }
    case "approval_request": {
      const item: ApprovalItem = {
        ...base,
        type: "approval",
        requestId: event.requestId,
        toolCallId: event.toolCallId,
        name: event.name,
        input: event.input,
        decision: null,
      }
      const openApprovals = new Map(state.openApprovals).set(event.requestId, item)
      return { state: { ...state, openMessage: null, openApprovals }, item }
    }
    case "approval_decision": {
      const request = state.openApprovals.get(event.requestId)
      if (!request) return { state, item: null }
      const item: ApprovalItem = { ...request, decision: event.allow ? "allow" : "deny" }
      const openApprovals = new Map(state.openApprovals)
      openApprovals.delete(event.requestId)
      return { state: { ...state, openApprovals }, item }
    }
    case "usage": {
      const item: TranscriptItem = {
        ...base,
        type: "usage",
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        costUsd: event.costUsd,
      }
      return { state, item }
    }
    case "error": {
      const item: TranscriptItem = { ...base, type: "error", message: event.message }
      return { state: { ...state, openMessage: null }, item }
    }
    case "status":
      return {
        state: event.status === "idle" ? { ...state, openMessage: null } : state,
        item: null,
      }
  }
}

export const deriveItems = (events: readonly TranscriptEvent[]): TranscriptItem[] => {
  const byId = new Map<string, TranscriptItem>()
  let state = emptyItemState
  for (const event of events) {
    const next = applyEvent(state, event)
    state = next.state
    if (next.item) byId.set(next.item.id, next.item)
  }
  return [...byId.values()].toSorted((a, b) => a.position - b.position)
}
