// following: Virtuoso may follow the end. holding: the sent message is kept at the top of the view.
// left: the user scrolled after sending, so nothing moves the view but Virtuoso following the end.
export type SentMessageMode = "following" | "holding" | "left"

export interface SentMessageScroll {
  readonly mode: SentMessageMode
  // Null until the transcript is loaded, so the turns already there when it opens are not scrolled to.
  readonly seen: {
    readonly turn: string | undefined
    readonly firstRow: string | undefined
    readonly lastRow: string | undefined
  } | null
  // `top` is the message's last known place in the content: Virtuoso unmounts it once out of view.
  readonly sent: { readonly id: string; readonly top: number | undefined } | undefined
  readonly scrolling: boolean
  readonly room: number
  // More room under the message than the footer's own height.
  readonly roomLeft: boolean
}

// What a tab saves and restores, while room is left under the message.
export interface SentMessagePlace {
  readonly id: string
  // Unknown while the view was still scrolling to the message.
  readonly top: number | undefined
  readonly room: number
  readonly userScrolled: boolean
}

// Places in the scrolled content, from its top.
export interface Measurement {
  readonly viewHeight: number
  readonly footerTop: number
  readonly footerMinHeight: number
  // Undefined while the list does not draw the message's row.
  readonly messageTop: number | undefined
}

export type SentMessageEvent =
  | {
      readonly type: "rows-changed"
      readonly loaded: boolean
      // The user message that opens the last turn.
      readonly turn: string | undefined
      readonly rows: ReadonlyArray<{ readonly id: string }>
      // Undefined while the list is not drawn.
      readonly view: Measurement | undefined
    }
  | { readonly type: "measured"; readonly view: Measurement }
  | { readonly type: "scroll-ended"; readonly view: Measurement | undefined }
  | { readonly type: "scroll-cancelled" }
  | { readonly type: "user-scrolled" }
  | {
      readonly type: "opened"
      readonly place: SentMessagePlace | undefined
      readonly footerMinHeight: number
    }

// `animate-to-message` eases to the message's row, or to the list's end until the row is drawn.
export type SentMessageScrollAction =
  | { readonly type: "animate-to-message" }
  | { readonly type: "jump"; readonly top: number }
  | { readonly type: "end" }

export interface SentMessageStep {
  readonly state: SentMessageScroll
  // The room to leave under the message, when it changes.
  readonly room?: number
  readonly scroll?: SentMessageScrollAction
}

export const initialSentMessageScroll: SentMessageScroll = {
  mode: "following",
  seen: null,
  sent: undefined,
  scrolling: false,
  room: 0,
  roomLeft: false,
}

export const nextSentMessageScroll = (
  state: SentMessageScroll,
  event: SentMessageEvent,
): SentMessageStep => {
  switch (event.type) {
    case "rows-changed":
      return rowsChanged(state, event)
    case "measured":
      return fit(state, event.view)
    case "scroll-ended": {
      const ended = { ...state, scrolling: false }
      return event.view?.messageTop === undefined ? withRoom(ended, 0, 0) : fit(ended, event.view)
    }
    case "scroll-cancelled":
      return { state: { ...state, scrolling: false } }
    case "user-scrolled":
      return { state: state.sent ? { ...state, mode: "left" } : state }
    case "opened": {
      const { place } = event
      if (!place) return { state }
      const opened = { ...state, sent: { id: place.id, top: place.top } }
      const step = withRoom(opened, place.room, event.footerMinHeight)
      return place.userScrolled ? { ...step, state: { ...step.state, mode: "left" } } : step
    }
  }
}

const rowsChanged = (
  state: SentMessageScroll,
  event: Extract<SentMessageEvent, { type: "rows-changed" }>,
): SentMessageStep => {
  if (!event.loaded) return { state }
  const { turn, rows, view } = event
  const previous = state.seen
  const seen = { turn, firstRow: rows[0]?.id, lastRow: rows.at(-1)?.id }
  // Older items loaded above move every row down.
  const olderLoaded = previous !== null && previous.firstRow !== seen.firstRow
  const next: SentMessageScroll = {
    ...state,
    seen,
    sent: olderLoaded && state.sent ? { ...state.sent, top: undefined } : state.sent,
  }
  if (!turnChanged(state, turn) || turn === undefined || previous === null || !view) {
    return { state: next }
  }
  // A message revealed by loading older items sits before the previous last row.
  const index = rows.findIndex((row) => row.id === turn)
  const lastIndex = rows.findIndex((row) => row.id === previous.lastRow)
  if (index <= lastIndex) return { state: next }
  const sending = withRoom(
    { ...next, mode: "holding", sent: { id: turn, top: undefined }, scrolling: true },
    view.viewHeight,
    view.footerMinHeight,
  )
  return { ...sending, scroll: { type: "animate-to-message" } }
}

const fit = (state: SentMessageScroll, view: Measurement): SentMessageStep => {
  if (state.scrolling || !state.sent) return { state }
  const top = view.messageTop ?? state.sent.top
  if (top === undefined) return { state }
  const tracked = { ...state, sent: { ...state.sent, top } }
  const step = withRoom(tracked, view.viewHeight - (view.footerTop - top), view.footerMinHeight)
  if (state.mode === "left") return step
  // The turn's rows can shrink before the room grows back, and the browser then scrolls up to fit.
  if (step.state.roomLeft) return { ...step, scroll: { type: "jump", top } }
  // Virtuoso follows only from the end, and a row taller than the room leaves the view short of it.
  if (state.roomLeft) return { ...step, scroll: { type: "end" } }
  return step
}

const withRoom = (
  state: SentMessageScroll,
  height: number,
  footerMinHeight: number,
): SentMessageStep => {
  const room = Math.max(0, height)
  const roomLeft = room > footerMinHeight
  const mode = state.mode === "left" ? "left" : roomLeft ? "holding" : "following"
  return { state: { ...state, mode, room, roomLeft }, room }
}

// A new last turn, which rows-changed sends to unless older items revealed it.
export const turnChanged = (state: SentMessageScroll, turn: string | undefined) =>
  state.seen !== null && turn !== undefined && turn !== state.seen.turn

// Virtuoso reads followOutput in the render that adds the sent message, before any event is handled.
export const mayFollowEnd = (state: SentMessageScroll, turn: string | undefined) =>
  !state.roomLeft && !turnChanged(state, turn)

// Measuring the view forces a layout, so it waits until there is a message to place.
export const needsMeasurement = (state: SentMessageScroll) =>
  !state.scrolling && state.sent !== undefined

export const sentMessagePlace = (state: SentMessageScroll): SentMessagePlace | undefined =>
  state.sent && state.roomLeft
    ? { ...state.sent, room: state.room, userScrolled: state.mode === "left" }
    : undefined
