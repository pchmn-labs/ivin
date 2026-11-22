import type { ToolKind, TranscriptEvent, TranscriptItem } from "@ivin/contracts/transcript"

type MessageItem = Extract<TranscriptItem, { type: "message" }>
type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>
type ApprovalItem = Extract<TranscriptItem, { type: "approval" }>
type QuestionItem = Extract<TranscriptItem, { type: "question" }>

export interface ItemState {
  readonly openMessage: MessageItem | null
  readonly openToolCalls: ReadonlyMap<string, ToolCallItem>
  readonly openRequests: ReadonlyMap<string, ApprovalItem | QuestionItem>
}

export const emptyItemState: ItemState = {
  openMessage: null,
  openToolCalls: new Map(),
  openRequests: new Map(),
}

const openRequest = (state: ItemState, item: ApprovalItem | QuestionItem): ItemState => ({
  ...state,
  openMessage: null,
  openRequests: new Map(state.openRequests).set(item.requestId, item),
})

const closeRequest = (state: ItemState, requestId: string): ItemState => {
  const openRequests = new Map(state.openRequests)
  openRequests.delete(requestId)
  return { ...state, openRequests }
}

export const applyEvent = (
  state: ItemState,
  event: TranscriptEvent,
  toolKind: (name: string) => ToolKind,
): { readonly state: ItemState; readonly item: TranscriptItem | null } => {
  const base = {
    id: event.id,
    sessionId: event.sessionId,
    position: event.sequence,
    at: event.at.epochMilliseconds,
  }
  switch (event.type) {
    case "user_message": {
      const item: MessageItem = {
        ...base,
        type: "message",
        role: "user",
        text: event.text,
        images: event.images ?? [],
        steer: event.steer ?? false,
      }
      return { state: { ...state, openMessage: null }, item }
    }
    case "assistant_text": {
      const item: MessageItem = state.openMessage
        ? { ...state.openMessage, text: `${state.openMessage.text}\n\n${event.text}` }
        : {
            ...base,
            type: "message",
            role: "assistant",
            text: event.text,
            images: [],
            steer: false,
          }
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
        kind: toolKind(event.name),
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
      return { state: openRequest(state, item), item }
    }
    case "approval_decision": {
      const request = state.openRequests.get(event.requestId)
      if (request?.type !== "approval") return { state, item: null }
      const item: ApprovalItem = { ...request, decision: event.allow ? "allow" : "deny" }
      return { state: closeRequest(state, event.requestId), item }
    }
    case "question_request": {
      const item: QuestionItem = {
        ...base,
        type: "question",
        requestId: event.requestId,
        toolCallId: event.toolCallId,
        questions: event.questions,
        status: "open",
        answers: [],
      }
      return { state: openRequest(state, item), item }
    }
    case "question_answer": {
      const request = state.openRequests.get(event.requestId)
      if (request?.type !== "question") return { state, item: null }
      const item: QuestionItem =
        event.answers === null
          ? { ...request, status: "declined" }
          : { ...request, status: "answered", answers: event.answers }
      return { state: closeRequest(state, event.requestId), item }
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
    case "interruption": {
      const item: TranscriptItem = { ...base, type: "interruption" }
      return { state: { ...state, openMessage: null }, item }
    }
    case "working_folder":
    case "run_option": {
      const { id: _id, sessionId: _s, sequence: _q, at: _at, raw: _raw, ...change } = event
      const item: TranscriptItem = { ...base, ...change }
      return { state: { ...state, openMessage: null }, item }
    }
    case "status":
      return {
        state: event.status === "idle" ? { ...state, openMessage: null } : state,
        item: null,
      }
  }
}

export const deriveItems = (
  events: readonly TranscriptEvent[],
  toolKind: (name: string) => ToolKind,
): TranscriptItem[] => {
  const byId = new Map<string, TranscriptItem>()
  let state = emptyItemState
  for (const event of events) {
    const next = applyEvent(state, event, toolKind)
    state = next.state
    if (next.item) byId.set(next.item.id, next.item)
  }
  return [...byId.values()].toSorted((a, b) => a.position - b.position)
}
