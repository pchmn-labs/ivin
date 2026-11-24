import { describe, expect, test } from "vitest"
import {
  initialSentMessageScroll,
  mayFollowEnd,
  needsMeasurement,
  nextSentMessageScroll,
  sentMessagePlace,
  type Measurement,
  type SentMessageEvent,
  type SentMessageScroll,
  type SentMessageStep,
} from "./sent-message-scroll.ts"

const VIEW = 300
const FOOTER_MIN = 32

const rowsUpTo = (last: number, first = 0) =>
  Array.from({ length: last - first + 1 }, (_, i) => ({ id: `m${first + i}` }))

// The transcript's turns: m0 opens the one already there, m40 the one the user sends.
const rows = (
  last: number,
  turn: string | undefined = "m0",
  first = 0,
): Extract<SentMessageEvent, { type: "rows-changed" }> => ({
  type: "rows-changed",
  loaded: true,
  turn,
  rows: rowsUpTo(last, first),
  view: measured(),
})

// A message whose row starts at 1000 in the content, with an answer `answer` px tall under it.
const measured = (answer = 40, overrides: Partial<Measurement> = {}): Measurement => ({
  viewHeight: VIEW,
  footerTop: 1000 + answer,
  footerMinHeight: FOOTER_MIN,
  messageTop: 1000,
  ...overrides,
})

const resized = (answer?: number, overrides?: Partial<Measurement>): SentMessageEvent => ({
  type: "measured",
  view: measured(answer, overrides),
})
const scrollEnded = (view: Measurement | undefined = measured()): SentMessageEvent => ({
  type: "scroll-ended",
  view,
})
const userScrolled: SentMessageEvent = { type: "user-scrolled" }

const opened = rows(39)
const sent = rows(40, "m40")

const run = (events: ReadonlyArray<SentMessageEvent>, from = initialSentMessageScroll) => {
  const steps: SentMessageStep[] = []
  let state: SentMessageScroll = from
  for (const event of events) {
    const step = nextSentMessageScroll(state, event)
    steps.push(step)
    state = step.state
  }
  return { state, steps, last: steps.at(-1)! }
}

describe("a sent message (#140)", () => {
  test("scrolls to the top of the view with the whole view as room", () => {
    const { last } = run([opened, sent])
    expect(last.scroll).toEqual({ type: "animate-to-message" })
    expect(last.room).toBe(VIEW)
    expect(last.state.mode).toBe("holding")
    expect(last.state.scrolling).toBe(true)
  })

  test("leaves room under the message for the answer once the scroll ends", () => {
    const { last } = run([opened, sent, scrollEnded(measured(40))])
    expect(last.room).toBe(VIEW - 40)
    expect(last.scroll).toEqual({ type: "jump", top: 1000 })
    expect(last.state.scrolling).toBe(false)
    expect(last.state.mode).toBe("holding")
  })

  test("keeps Virtuoso from following the end while room is left", () => {
    const { state } = run([opened, sent, scrollEnded()])
    expect(mayFollowEnd(state, "m40")).toBe(false)
  })

  test("hands over to following the end once the answer is taller than the view", () => {
    const { last, state } = run([opened, sent, scrollEnded(), resized(VIEW + 200)])
    expect(last.room).toBe(0)
    expect(last.scroll).toEqual({ type: "end" })
    expect(state.mode).toBe("following")
    expect(mayFollowEnd(state, "m40")).toBe(true)
  })

  test("drops the room when the list never draws the message", () => {
    const { last, state } = run([
      opened,
      sent,
      scrollEnded(measured(40, { messageTop: undefined })),
    ])
    expect(last.room).toBe(0)
    expect(last.scroll).toBeUndefined()
    expect(state.mode).toBe("following")
  })

  test("a new sent message starts over from the previous one", () => {
    const { last } = run([
      opened,
      sent,
      scrollEnded(),
      userScrolled,
      { ...rows(42, "m42"), view: measured() },
    ])
    expect(last.scroll).toEqual({ type: "animate-to-message" })
    expect(last.state.mode).toBe("holding")
    expect(last.state.sent).toEqual({ id: "m42", top: undefined })
  })
})

describe("the answer arriving during the scroll (#159)", () => {
  test("Virtuoso does not follow the end in the render that adds the message", () => {
    const { state } = run([opened])
    expect(mayFollowEnd(state, "m40")).toBe(false)
  })

  test("rows and resizes during the scroll move nothing", () => {
    const { steps } = run([opened, sent, rows(41, "m40"), resized(60), resized(VIEW + 200)])
    for (const step of steps.slice(2)) {
      expect(step.scroll).toBeUndefined()
      expect(step.room).toBeUndefined()
    }
  })

  test("the room fits the answer that arrived once the scroll ends", () => {
    const { last } = run([opened, sent, rows(41, "m40"), resized(80), scrollEnded(measured(80))])
    expect(last.room).toBe(VIEW - 80)
    expect(last.scroll).toEqual({ type: "jump", top: 1000 })
  })

  test("an answer already taller than the view when the scroll ends is followed", () => {
    const { last, state } = run([
      opened,
      sent,
      resized(VIEW + 200),
      scrollEnded(measured(VIEW + 200)),
    ])
    expect(last.scroll).toEqual({ type: "end" })
    expect(state.mode).toBe("following")
  })

  test("the message goes back to the top when the turn's rows shrink as it ends", () => {
    const { last } = run([opened, sent, scrollEnded(measured(200)), resized(60)])
    expect(last.room).toBe(VIEW - 60)
    expect(last.scroll).toEqual({ type: "jump", top: 1000 })
  })
})

describe("a row arriving right after the room is used up (#169)", () => {
  test("the end is scrolled to once, then Virtuoso follows the rows that come", () => {
    const { steps, state } = run([
      opened,
      sent,
      scrollEnded(),
      resized(VIEW + 10),
      rows(41, "m40"),
      resized(VIEW + 50),
    ])
    expect(steps[3]!.scroll).toEqual({ type: "end" })
    expect(steps[4]!.scroll).toBeUndefined()
    expect(steps[5]!.scroll).toBeUndefined()
    expect(mayFollowEnd(state, "m40")).toBe(true)
  })
})

describe("an approval sheet hiding the message (#188)", () => {
  const hidden = resized(40, { viewHeight: 80, messageTop: undefined })

  test("the view shrinking under the answer follows the end", () => {
    const { last, state } = run([
      opened,
      sent,
      scrollEnded(measured(40)),
      resized(40, { viewHeight: 30 }),
    ])
    expect(last.room).toBe(0)
    expect(last.scroll).toEqual({ type: "end" })
    expect(state.mode).toBe("following")
  })

  test("the message goes back to the top from its last known place when the view grows back", () => {
    const { last, state } = run([
      opened,
      sent,
      scrollEnded(measured(40)),
      resized(40, { viewHeight: 30 }),
      hidden,
      resized(40, { messageTop: undefined }),
    ])
    expect(last.room).toBe(VIEW - 40)
    expect(last.scroll).toEqual({ type: "jump", top: 1000 })
    expect(state.mode).toBe("holding")
  })

  test("the same, when the answer grows while the message is hidden", () => {
    const { last } = run([
      opened,
      sent,
      scrollEnded(measured(40)),
      resized(40, { viewHeight: 30 }),
      rows(41, "m40"),
      resized(100, { viewHeight: 30, messageTop: undefined }),
      resized(100, { messageTop: undefined }),
    ])
    expect(last.room).toBe(VIEW - 100)
    expect(last.scroll).toEqual({ type: "jump", top: 1000 })
  })

  test("the same, when the sheet opens during the scroll", () => {
    const { last } = run([
      opened,
      sent,
      hidden,
      scrollEnded(measured(40, { viewHeight: 30 })),
      resized(40, { messageTop: undefined }),
    ])
    expect(last.room).toBe(VIEW - 40)
    expect(last.scroll).toEqual({ type: "jump", top: 1000 })
  })

  test("a place forgotten when older items load above is not used", () => {
    const { last } = run([
      opened,
      sent,
      scrollEnded(measured(40)),
      resized(40, { viewHeight: 30 }),
      rows(41, "m40", -10),
      resized(40, { messageTop: undefined }),
    ])
    expect(last.room).toBeUndefined()
    expect(last.scroll).toBeUndefined()
  })
})

describe("the user scrolling", () => {
  test("after the scroll, the message is no longer put back at the top", () => {
    const { last, state } = run([opened, sent, scrollEnded(), userScrolled, resized(60)])
    expect(last.room).toBe(VIEW - 60)
    expect(last.scroll).toBeUndefined()
    expect(state.mode).toBe("left")
  })

  test("during the scroll, the scroll ends where it was going, and nothing moves after", () => {
    const { steps, state } = run([opened, sent, userScrolled, scrollEnded(), resized(60)])
    expect(steps[3]!.room).toBe(VIEW - 40)
    expect(steps[3]!.scroll).toBeUndefined()
    expect(steps[4]!.scroll).toBeUndefined()
    expect(state.mode).toBe("left")
  })

  test("after the answer outgrew the view, the view stays where the user scrolled when it grows", () => {
    const { last, state } = run([
      opened,
      sent,
      scrollEnded(),
      resized(VIEW + 200),
      userScrolled,
      resized(40, { viewHeight: 900 }),
    ])
    expect(last.scroll).toBeUndefined()
    expect(state.mode).toBe("left")
  })

  test("before any message is sent, changes nothing", () => {
    const { state } = run([opened, userScrolled])
    expect(state.mode).toBe("following")
  })

  test("Virtuoso follows the end once the room left under the message is used up", () => {
    const { state } = run([opened, sent, scrollEnded(), userScrolled, resized(VIEW + 200)])
    expect(mayFollowEnd(state, "m40")).toBe(true)
  })
})

describe("the transcript opening (#195)", () => {
  test("the turns already there are not scrolled to", () => {
    const { last } = run([rows(39, "m30")])
    expect(last.scroll).toBeUndefined()
    expect(last.room).toBeUndefined()
  })

  test("rows that change before the transcript is loaded are not seen", () => {
    const { last } = run([{ ...rows(0, undefined), loaded: false }, rows(39, "m30")])
    expect(last.scroll).toBeUndefined()
  })

  test("a message is not scrolled to while the list is not drawn", () => {
    const { last } = run([opened, { ...sent, view: undefined }])
    expect(last.scroll).toBeUndefined()
    expect(mayFollowEnd(last.state, "m40")).toBe(true)
  })
})

describe("older items loaded above (#158)", () => {
  test("a message they reveal is not scrolled to", () => {
    const { last } = run([rows(80, undefined, 1), rows(80, "m0", 0)])
    expect(last.scroll).toBeUndefined()
  })

  test("no measurement is needed when no message was sent", () => {
    const { state } = run([rows(80, undefined, 1), rows(80, "m0", 0)])
    expect(needsMeasurement(state)).toBe(false)
  })
})

describe("the place a tab saves and restores (#199)", () => {
  test("is saved while room is left under the message", () => {
    const { state } = run([opened, sent, scrollEnded()])
    expect(sentMessagePlace(state)).toEqual({
      id: "m40",
      top: 1000,
      room: VIEW - 40,
      userScrolled: false,
    })
  })

  test("is not saved while the message's top is unknown", () => {
    const { state } = run([opened, sent, { type: "scroll-cancelled", view: undefined }])
    expect(sentMessagePlace(state)).toBeUndefined()
  })

  test("is saved with the top the list draws the message at when the scroll stops", () => {
    const { state } = run([opened, sent, { type: "scroll-cancelled", view: measured() }])
    expect(sentMessagePlace(state)).toEqual({
      id: "m40",
      top: 1000,
      room: VIEW,
      userScrolled: false,
    })
  })

  test("is not saved once the answer used up the room", () => {
    const { state } = run([opened, sent, scrollEnded(), resized(VIEW + 200)])
    expect(sentMessagePlace(state)).toBeUndefined()
  })

  test("says the user scrolled", () => {
    const { state } = run([opened, sent, scrollEnded(), userScrolled])
    expect(sentMessagePlace(state)?.userScrolled).toBe(true)
  })

  const place = { id: "m40", top: 1000, room: VIEW - 40, userScrolled: false }
  const open = (restored = place): SentMessageEvent[] => [
    rows(40, "m40"),
    { type: "opened", place: restored, footerMinHeight: FOOTER_MIN },
  ]

  test("opens with the message held at the top and its room", () => {
    const { last, state } = run(open())
    expect(last.room).toBe(VIEW - 40)
    expect(state.mode).toBe("holding")
    expect(sentMessagePlace(state)).toEqual(place)
    expect(mayFollowEnd(state, "m40")).toBe(false)
  })

  test("opens with the room the answer that came meanwhile leaves", () => {
    const { last } = run([...open(), rows(41, "m40"), resized(80, { messageTop: undefined })])
    expect(last.room).toBe(VIEW - 80)
    expect(last.scroll).toEqual({ type: "jump", top: 1000 })
  })

  test("opens at the end when the answer grew taller than the view meanwhile", () => {
    const { last, state } = run([...open(), resized(VIEW + 200, { messageTop: undefined })])
    expect(last.scroll).toEqual({ type: "end" })
    expect(state.mode).toBe("following")
  })

  test("keeps its room while the list has not laid out its rows yet", () => {
    const { steps, state } = run([
      ...open(),
      { type: "measured", view: measured(40, { footerTop: 0, messageTop: undefined }) },
    ])
    expect(steps.at(-1)).toEqual({ state: steps.at(-2)!.state })
    expect(state.room).toBe(VIEW - 40)
  })

  test("opens where the user had scrolled", () => {
    const { last, state } = run([...open({ ...place, userScrolled: true }), resized(80)])
    expect(last.scroll).toBeUndefined()
    expect(state.mode).toBe("left")
  })

  test("opens with nothing to restore as a transcript with no sent message", () => {
    const { state } = run([
      opened,
      { type: "opened", place: undefined, footerMinHeight: FOOTER_MIN },
    ])
    expect(state).toEqual(run([opened]).state)
  })

  test("the opened transcript's own turn is not scrolled to again", () => {
    const { last } = run([
      rows(40, "m40"),
      { type: "opened", place, footerMinHeight: FOOTER_MIN },
      rows(41, "m40"),
    ])
    expect(last.scroll).toBeUndefined()
  })
})

describe("orders of the answer, the resize and the user's scroll", () => {
  const answer = rows(41, "m40")
  const grown = resized(80)
  const shrunk = resized(80, { viewHeight: 30, messageTop: undefined })
  const back = resized(80, { messageTop: undefined })

  test.each([
    ["answer, then the scroll ends", [answer, grown, scrollEnded(measured(80))]],
    ["the scroll ends, then the answer", [scrollEnded(measured(40)), answer, grown]],
    [
      "the view shrinks and grows during the scroll",
      [shrunk, back, answer, grown, scrollEnded(measured(80))],
    ],
    [
      "the view shrinks during the scroll, grows after",
      [answer, shrunk, scrollEnded(measured(80, { viewHeight: 30 })), back],
    ],
    [
      "the view shrinks and grows after the scroll",
      [scrollEnded(measured(40)), answer, shrunk, back],
    ],
  ] as const)("%s: the message ends at the top with room for the answer", (_, events) => {
    const { last, state } = run([opened, sent, ...events])
    expect(last.room).toBe(VIEW - 80)
    expect(last.scroll).toEqual({ type: "jump", top: 1000 })
    expect(state.mode).toBe("holding")
  })

  test.each([
    [
      "the user scrolls before the answer",
      [userScrolled, answer, grown, scrollEnded(measured(80))],
    ],
    [
      "the user scrolls during the answer",
      [answer, userScrolled, scrollEnded(measured(80)), grown],
    ],
    [
      "the user scrolls after the scroll ends",
      [scrollEnded(measured(40)), userScrolled, answer, grown],
    ],
    [
      "the user scrolls while the view is shrunk",
      [scrollEnded(measured(40)), shrunk, userScrolled, back],
    ],
  ] as const)("%s: the view stays where the user left it", (_, events) => {
    const { steps, state } = run([opened, sent, ...events])
    const after = steps.slice(2 + events.indexOf(userScrolled) + 1)
    for (const step of after) expect(step.scroll).toBeUndefined()
    expect(state.mode).toBe("left")
  })

  test.each([
    [
      "the answer outgrows the view during the scroll",
      [resized(VIEW + 200), scrollEnded(measured(VIEW + 200))],
    ],
    ["after the scroll", [scrollEnded(measured(40)), resized(VIEW + 200)]],
    [
      "while the view is shrunk",
      [scrollEnded(measured(40)), resized(VIEW + 200, { viewHeight: 30 }), resized(VIEW + 200)],
    ],
  ] as const)("%s: the transcript follows the end", (_, events) => {
    const { state } = run([opened, sent, ...events])
    expect(state.mode).toBe("following")
    expect(mayFollowEnd(state, "m40")).toBe(true)
  })
})
