import type { TranscriptItem } from "@ivin/contracts/transcript"

export const message = (position: number, text = `message ${position}`): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "message",
  role: "assistant",
  text,
  images: [],
  steer: false,
})

export const userMessage = (position: number): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "message",
  role: "user",
  text: `question ${position}`,
  images: [],
  steer: false,
})

export const toolCall = (position: number): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "tool_call",
  toolCallId: `t${position}`,
  name: "Bash",
  kind: "command",
  input: { command: `command ${position}` },
  status: "done",
  output: `output ${position}`,
})

export const scroller = () => document.querySelector<HTMLElement>('[data-testid="transcript"]')!

// The browser sends the scroll event once the view has moved, after Virtuoso has seen it.
export const scrollEvent = () =>
  new Promise<void>((resolve) =>
    scroller().addEventListener("scroll", () => resolve(), { once: true }),
  )

export const fromEnd = () =>
  scroller().scrollHeight - scroller().clientHeight - scroller().scrollTop
