import type {
  HarnessEvent,
  ToolKind,
  TranscriptEvent,
  TranscriptItem,
} from "@ivin/contracts/transcript"

type MessageItem = Extract<TranscriptItem, { type: "message" }>
type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>
type ApprovalItem = Extract<TranscriptItem, { type: "approval" }>
type QuestionItem = Extract<TranscriptItem, { type: "question" }>

// Bump when a change to these rules alters items already stored, so they are derived again.
export const ITEMS_VERSION = 1

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
    case "request_unanswered": {
      const request = state.openRequests.get(event.requestId)
      if (!request) return { state, item: null }
      const item: ApprovalItem | QuestionItem =
        request.type === "approval"
          ? { ...request, decision: "unanswered" }
          : { ...request, status: "unanswered" }
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
      const { id: _id, sessionId: _s, sequence: _q, at: _at, ...change } = event
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

// The items `events` create or change after `state`, each in its last form, by position.
export const replay = (
  events: readonly TranscriptEvent[],
  toolKind: (name: string) => ToolKind,
  from: ItemState = emptyItemState,
): { readonly items: TranscriptItem[]; readonly state: ItemState } => {
  const byId = new Map<string, TranscriptItem>()
  let state = from
  for (const event of events) {
    const next = applyEvent(state, event, toolKind)
    state = next.state
    if (next.item) byId.set(next.item.id, next.item)
  }
  return { items: [...byId.values()].toSorted((a, b) => a.position - b.position), state }
}

// Closes each open request; an approval's tool call never ran, so it fails rather than spin.
export const unansweredEvents = (state: ItemState): HarnessEvent[] =>
  [...state.openRequests.values()].flatMap((request): HarnessEvent[] => {
    const closed: HarnessEvent = {
      type: "request_unanswered",
      requestId: request.requestId,
      raw: null,
    }
    const call =
      request.type === "approval" && request.toolCallId !== null
        ? state.openToolCalls.get(request.toolCallId)
        : undefined
    if (!call) return [closed]
    return [
      closed,
      {
        type: "tool_result",
        toolCallId: call.toolCallId,
        output: "Not run: the approval was not answered.",
        isError: true,
        raw: null,
      },
    ]
  })
