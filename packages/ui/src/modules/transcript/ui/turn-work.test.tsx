import { RegistryProvider } from "@effect/atom-react"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ToolKind, TranscriptItem } from "@ivin/contracts/transcript"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { TranscriptView } from "./transcript-view.tsx"

const items = (origin = 0) => {
  let position = 0
  const base = (id: string) => ({
    id,
    sessionId: "s1",
    position: position++,
    at: origin + position * 1000,
  })
  return {
    user: (id: string, text = id): TranscriptItem => ({
      ...base(id),
      type: "message",
      role: "user",
      text,
      images: [],
      steer: false,
    }),
    text: (id: string, text = id): TranscriptItem => ({
      ...base(id),
      type: "message",
      role: "assistant",
      text,
      images: [],
      steer: false,
    }),
    call: (
      id: string,
      kind: ToolKind = "command",
      status: "running" | "done" | "error" = "done",
    ): TranscriptItem => ({
      ...base(id),
      type: "tool_call",
      toolCallId: id,
      name: `tool-${id}`,
      kind,
      input: { command: `command ${id}` },
      status,
      output: status === "running" ? null : `output ${id}`,
    }),
    interruption: (id: string): TranscriptItem => ({ ...base(id), type: "interruption" }),
  }
}

const view = (
  server: ReturnType<typeof makeFakeServer>,
  { sessionId = "s1", live = false, height = 600 } = {},
) => (
  <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
    <div style={{ height }}>
      <PluginsProvider plugins={builtinPlugins}>
        <TranscriptView sessionId={sessionId} live={live} />
      </PluginsProvider>
    </div>
  </RegistryProvider>
)

const mount = async (seeded: TranscriptItem[], live = false, height = 600) => {
  const server = makeFakeServer()
  server.seedItems("s1", seeded)
  await render(view(server, { live, height }))
  return server
}

const toolRows = () => document.querySelectorAll('[data-testid="turn"] [data-testid="tool-output"]')
const turnLine = () => page.getByTestId("turn-line")
const markOf = (element: Element) => element.querySelector<HTMLElement>(".iv-turn__mark")!
const shown = (element: HTMLElement) => getComputedStyle(element).opacity === "1"

test("a running turn stays unfolded, with its last step open and the steps before folded", async () => {
  const { user, text, call } = items(Date.now() - 20_000)
  await mount(
    [
      user("u1", "fix it"),
      text("t1", "Looking at the code"),
      call("c1", "read"),
      text("t2", "Running the tests"),
      call("c2", "command", "error"),
      call("c3", "command", "running"),
    ],
    true,
  )

  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "true")
  expect(turnLine().element().textContent).toMatch(/^Working for [12]\ds · 1 failed$/)
  await expect.element(page.getByText("Looking at the code")).toBeVisible()
  await expect.element(page.getByText("Running the tests")).toBeVisible()
  await expect.element(page.getByText("tool-c3")).toBeVisible()
  expect(toolRows()).toHaveLength(2)
  await expect
    .element(page.getByTestId("step-summary").nth(0))
    .toHaveAttribute("aria-expanded", "false")
  await vi.waitFor(() => expect(shown(markOf(turnLine().element()))).toBe(true))
  expect(markOf(turnLine().element()).querySelector(".iv-icon--spin")).not.toBeNull()
  const running = markOf(page.getByTestId("step-summary").nth(1).element())
  await vi.waitFor(() => expect(shown(running)).toBe(true))
  expect(running.querySelector(".iv-icon--spin")).not.toBeNull()
  const steps = page.getByTestId("turn-step")
  expect(steps.nth(0).element().hasAttribute("data-current")).toBe(false)
  expect(steps.nth(1).element().hasAttribute("data-current")).toBe(true)
})

test("a turn that has just started shows its line with no timeline under it", async () => {
  const { user } = items(Date.now())
  await mount([user("u1", "fix it")], true)

  await expect.element(page.getByText(/^Working for/)).toBeVisible()
  expect(document.querySelector(".iv-turn__timeline")).toBeNull()
})

test("while the turn runs, a sentence streamed after the last call heads a step and never shows as the answer", async () => {
  const { user, text, call } = items(Date.now())
  const server = await mount([user("u1", "fix it"), text("t1", "Looking"), call("c1")], true)
  await expect.element(page.getByText("tool-c1")).toBeVisible()
  const outsideTurn: string[] = []
  // Only the rows outside a turn's work carry `data-row-id`.
  const observer = new MutationObserver(() => {
    for (const row of document.querySelectorAll("[data-row-id]")) {
      if (row.textContent?.includes("Running")) outsideTurn.push(row.getAttribute("data-row-id")!)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  const sentence = text("t2", "Running the tests")
  server.pushChange({
    type: "delta",
    sessionId: "s1",
    itemId: sentence.id,
    position: sentence.position,
    kind: "message",
    text: "Running",
  })
  await expect.element(page.getByText("Running", { exact: true })).toBeVisible()
  server.pushItem(sentence)
  await expect.element(page.getByText("Running the tests")).toBeVisible()
  const steps = page.getByTestId("turn-step")
  await expect.element(steps.nth(1)).toHaveTextContent("Running the tests")
  await expect.element(steps.nth(1)).toHaveAttribute("data-current")
  expect(steps.nth(1).element().querySelector('[data-testid="step-summary"]')).toBeNull()
  await expect
    .element(page.getByTestId("step-summary").nth(0))
    .toHaveAttribute("aria-expanded", "false")

  server.pushItem(call("c2", "command", "running"))
  await expect.element(page.getByText("tool-c2")).toBeVisible()
  await vi.waitFor(() => {
    const step = steps.nth(1).element()
    expect(step.textContent).toContain("tool-c2")
  })
  observer.disconnect()
  expect(outsideTurn).toEqual([])
})

test("when the turn ends, the text after its last call leaves the timeline and becomes the answer", async () => {
  const { user, text, call } = items()
  const server = makeFakeServer()
  server.seedItems("s1", [user("u1", "fix it"), call("c1"), text("a", "Fixed it")])
  const screen = await render(view(server, { live: true }))
  await expect.element(page.getByTestId("turn-step").nth(1)).toHaveTextContent("Fixed it")

  await screen.rerender(view(server))
  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "false")
  await expect.element(turnLine()).toHaveTextContent("Worked for 2s · 1 tool call")
  await expect.element(page.getByText("Fixed it")).toBeVisible()
  expect(page.getByText("Fixed it").element().closest('[data-testid="turn"]')).toBeNull()
})

test("a finished turn folds its work behind one line, and shows the user's message and the answer", async () => {
  const { user, text, call } = items()
  await mount([
    user("u1", "fix it"),
    text("t1", "Looking"),
    call("c1"),
    call("c2", "read", "error"),
    text("a", "Fixed it"),
  ])

  await expect.element(turnLine()).toHaveTextContent("Worked for 4s · 2 tool calls · 1 failed")
  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "false")
  await expect.element(page.getByText("fix it")).toBeVisible()
  await expect.element(page.getByText("Fixed it")).toBeVisible()
  expect(page.getByText("Looking").query()).toBeNull()
  expect(toolRows()).toHaveLength(0)
})

test("unfolded, each sentence heads a step with a summary of its calls", async () => {
  const { user, text, call } = items()
  await mount([
    user("u1"),
    call("c0", "search"),
    text("t1", "Reading the files"),
    call("c1"),
    call("c2"),
    call("c3", "read"),
    call("c4", "command", "error"),
    text("a", "Done"),
  ])

  await turnLine().click()

  const summaries = page.getByTestId("step-summary")
  await expect.element(summaries.nth(0)).toHaveTextContent("Searched")
  await expect
    .element(summaries.nth(1))
    .toHaveTextContent("Ran 3 commands · read 1 file · 1 failed")
  await expect.element(page.getByText("Reading the files")).toBeVisible()
  expect(toolRows()).toHaveLength(5)
  expect(page.getByTestId("turn-step").nth(1).element().hasAttribute("data-failed")).toBe(true)
})

test("a turn of 9 calls opens its steps folded, but for a failed call and a subagent call", async () => {
  const { user, text, call } = items()
  await mount([
    user("u1"),
    text("t1", "First"),
    ...["c1", "c2", "c3", "c4"].map((id) => call(id)),
    call("c5", "agent"),
    text("t2", "Second"),
    call("c6"),
    call("c7", "read", "error"),
    call("c8"),
    call("c9"),
    text("a", "Done"),
  ])

  await turnLine().click()

  await expect.element(page.getByText("tool-c5")).toBeVisible()
  await expect.element(page.getByText("tool-c7")).toBeVisible()
  expect(toolRows()).toHaveLength(2)
  await page.getByTestId("step-summary").nth(0).click()
  expect(toolRows()).toHaveLength(6)
})

test("an answered turn shows a check, and the chevron takes its place once unfolded", async () => {
  const { user, text, call } = items()
  await mount([user("u1"), text("t1", "Step"), call("c1"), text("a", "Done")])

  await expect.element(turnLine()).toBeVisible()
  const mark = markOf(turnLine().element())
  expect(mark.dataset.outcome).toBe("answered")
  await vi.waitFor(() => expect(shown(mark)).toBe(true))

  await turnLine().click()
  await page.getByText("Done").hover()
  await vi.waitFor(() => expect(shown(mark)).toBe(false))
})

test("a stopped turn stays unfolded and says it stopped", async () => {
  const { user, text, call, interruption } = items()
  await mount([user("u1"), text("t1", "Trying"), call("c1"), interruption("i")])

  await expect.element(turnLine()).toHaveTextContent("Stopped after 3s · 1 tool call")
  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "true")
  expect(markOf(turnLine().element()).dataset.outcome).toBe("stopped")
  await vi.waitFor(() => expect(shown(markOf(turnLine().element()))).toBe(true))
  await expect.element(page.getByText("Trying")).toBeVisible()
})

test("the keyboard folds and unfolds the turn line and a step summary", async () => {
  const { user, text, call } = items()
  await mount([user("u1"), text("t1", "Step"), call("c1"), text("a", "Done")])

  await expect.element(turnLine()).toBeVisible()
  ;(turnLine().element() as HTMLElement).focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "true")
  await expect.element(page.getByText("tool-c1")).toBeVisible()

  await userEvent.tab()
  await expect.element(page.getByTestId("step-summary")).toHaveFocus()
  await userEvent.keyboard(" ")
  await expect.element(page.getByTestId("step-summary")).toHaveAttribute("aria-expanded", "false")
  expect(toolRows()).toHaveLength(0)

  ;(turnLine().element() as HTMLElement).focus()
  await userEvent.keyboard(" ")
  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "false")
})

test("unfolding the last turn does not scroll the transcript", async () => {
  const { user, text, call } = items()
  const turns = Array.from({ length: 6 }, (_, t) => [
    user(`u${t}`),
    text(`t${t}`, `Step ${t}`),
    ...Array.from({ length: 6 }, (_, c) => call(`c${t}-${c}`)),
    text(`a${t}`, `Answer ${t}`),
  ]).flat()
  await mount(turns, false, 300)
  const scroller = document.querySelector<HTMLElement>('[data-testid="transcript"]')!
  await expect.element(page.getByText("Answer 5")).toBeVisible()
  await vi.waitFor(() => {
    scroller.scrollTop = scroller.scrollHeight
    expect(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight).toBeLessThan(2)
  })
  const before = scroller.scrollTop

  await page.getByTestId("turn-line").last().click()
  await expect
    .element(page.getByTestId("turn-line").last())
    .toHaveAttribute("aria-expanded", "true")
  await expect.element(page.getByTestId("tool-output").first()).toBeVisible()

  expect(scroller.scrollTop).toBe(before)
})

test("a session of 200 turns of 30 calls scrolls without rendering the folded calls", async () => {
  const { user, text, call } = items()
  const turns = Array.from({ length: 200 }, (_, t) => [
    user(`u${t}`, `Question ${t}`),
    text(`t${t}`),
    ...Array.from({ length: 30 }, (_, c) => call(`c${t}-${c}`)),
    text(`a${t}`, `Answer ${t}`),
  ]).flat()
  await mount(turns, false, 400)
  const scroller = document.querySelector<HTMLElement>('[data-testid="transcript"]')!
  await expect.element(page.getByText("Answer 199")).toBeVisible()

  const answers = () =>
    [...(scroller.textContent ?? "").matchAll(/Answer (\d+)/g)].map((match) => Number(match[1]))
  // Answers 198 and 199 are on the first page, so a lower one means an older page rendered;
  // which turn ends up on top depends on how many pages the machine loaded.
  const toolRowsSeen: number[] = []
  await vi.waitFor(() => {
    scroller.scrollTop = 0
    toolRowsSeen.push(toolRows().length)
    expect(Math.min(...answers())).toBeLessThan(198)
  })
  expect(Math.max(...toolRowsSeen)).toBe(0)
  expect(document.querySelectorAll('[data-testid="turn"]').length).toBeLessThan(20)
})

const earlierLine = () => page.getByTestId("earlier-steps")
const scroller = () => document.querySelector<HTMLElement>('[data-testid="transcript"]')!
const topOf = (element: Element) => element.getBoundingClientRect().top

// Step n holds one call c<n>; the agent writes "Step n" before it.
const stepsOf = (count: number, options: { failed?: number[]; agent?: number[] } = {}) => {
  const { user, text, call } = items(Date.now())
  return [
    user("u1", "fix it"),
    ...Array.from({ length: count }, (_, i) => {
      const n = i + 1
      const status = options.failed?.includes(n) ? "error" : n === count ? "running" : "done"
      return [
        text(`t${n}`, `Step ${n}`),
        call(`c${n}`, options.agent?.includes(n) ? "agent" : "command", status),
      ]
    }).flat(),
  ]
}

const scrollToEnd = async () => {
  await vi.waitFor(() => {
    scroller().scrollTop = scroller().scrollHeight
    expect(scroller().scrollHeight - scroller().scrollTop - scroller().clientHeight).toBeLessThan(2)
  })
}

test("a running turn of 13 steps shows its last 3 under one line, and nothing of the 10 before", async () => {
  await mount(stepsOf(13, { failed: [2, 4], agent: [5] }), true)

  await expect.element(earlierLine()).toHaveTextContent("10 earlier steps · 2 failed")
  await expect.element(earlierLine()).toHaveAttribute("aria-expanded", "false")
  expect(page.getByTestId("turn-step").all()).toHaveLength(3)
  await expect.element(page.getByText("Step 11")).toBeVisible()
  for (const hidden of ["Step 1", "Step 10", "tool-c2", "tool-c4", "tool-c5"]) {
    expect(page.getByText(hidden, { exact: true }).query()).toBeNull()
  }
})

test("a running turn of 3 steps has no earlier steps line", async () => {
  await mount(stepsOf(3), true)

  await expect.element(page.getByText("Step 1", { exact: true })).toBeVisible()
  expect(earlierLine().query()).toBeNull()
})

test("a click and Enter unfold and fold the earlier steps, and the line stays in place", async () => {
  await mount(stepsOf(13, { failed: [2] }), true, 400)
  await expect.element(earlierLine()).toBeVisible()
  await scrollToEnd()
  const before = topOf(earlierLine().element())

  await earlierLine().click()
  await expect.element(earlierLine()).toHaveTextContent("Hide 10 earlier steps · 1 failed")
  await expect.element(earlierLine()).toHaveAttribute("aria-expanded", "true")
  expect(page.getByTestId("turn-step").all()).toHaveLength(13)
  expect(topOf(earlierLine().element())).toBe(before)

  await userEvent.keyboard("{Enter}")
  await expect.element(earlierLine()).toHaveTextContent("10 earlier steps · 1 failed")
  expect(page.getByTestId("turn-step").all()).toHaveLength(3)
  expect(topOf(earlierLine().element())).toBe(before)

  await userEvent.keyboard("{Enter}")
  await expect.element(earlierLine()).toHaveAttribute("aria-expanded", "true")
  expect(topOf(earlierLine().element())).toBe(before)
})

test("unfolded earlier steps stay unfolded after a session switch", async () => {
  const server = makeFakeServer()
  server.seedItems("s1", stepsOf(13))
  server.seedItems("s2", [items().user("other", "Another session")])
  const screen = await render(view(server, { live: true }))
  await earlierLine().click()
  await expect.element(earlierLine()).toHaveAttribute("aria-expanded", "true")

  await screen.rerender(view(server, { sessionId: "s2", live: true }))
  await expect.element(page.getByText("Another session")).toBeVisible()
  await screen.rerender(view(server, { live: true }))

  await expect.element(earlierLine()).toHaveAttribute("aria-expanded", "true")
  expect(page.getByTestId("turn-step").all()).toHaveLength(13)
})

const callList = () =>
  page.getByTestId("turn-step").last().element().querySelector<HTMLElement>(".iv-turn__calls")!
const atListEnd = (list: HTMLElement) => list.scrollHeight - list.scrollTop - list.clientHeight < 2

test("while the turn runs, an open step of 11 calls shows 8 rows that follow the newest call", async () => {
  const { user, text, call } = items(Date.now())
  const server = await mount(
    [user("u1"), text("t1", "Running"), ...Array.from({ length: 11 }, (_, i) => call(`c${i + 1}`))],
    true,
  )
  await expect.element(page.getByText("tool-c11")).toBeVisible()
  const list = callList()
  const row = list.querySelector<HTMLElement>(".iv-turn__call")!.offsetHeight
  expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
  expect(Math.round(list.clientHeight / row)).toBe(8)
  await vi.waitFor(() => expect(atListEnd(list)).toBe(true))

  list.scrollTop = 0
  list.dispatchEvent(new Event("scroll"))
  server.pushItem(call("c12"))
  await expect.element(page.getByText("tool-c12")).toBeInTheDocument()
  expect(callList().scrollTop).toBe(0)

  list.scrollTop = list.scrollHeight
  list.dispatchEvent(new Event("scroll"))
  server.pushItem(call("c13"))
  await expect.element(page.getByText("tool-c13")).toBeVisible()
  await vi.waitFor(() => expect(atListEnd(callList())).toBe(true))
})

test("a wheel up in the calls keeps their place when a call arrives before the scroll event", async () => {
  const { user, text, call } = items(Date.now())
  const server = await mount(
    [user("u1"), text("t1", "Running"), ...Array.from({ length: 11 }, (_, i) => call(`c${i + 1}`))],
    true,
  )
  await expect.element(page.getByText("tool-c11")).toBeVisible()
  const list = callList()
  await vi.waitFor(() => expect(atListEnd(list)).toBe(true))

  list.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, bubbles: true }))
  list.scrollTop = 0
  server.pushItem(call("c12"))
  await expect.element(page.getByText("tool-c12")).toBeInTheDocument()
  expect(callList().scrollTop).toBe(0)
})

test("an open step of 8 calls does not scroll", async () => {
  const { user, text, call } = items(Date.now())
  await mount(
    [user("u1"), text("t1", "Running"), ...Array.from({ length: 8 }, (_, i) => call(`c${i + 1}`))],
    true,
  )
  await expect.element(page.getByText("tool-c8")).toBeVisible()
  expect(callList().scrollHeight).toBe(callList().clientHeight)
})

test("once the turn ends, the earlier steps line and the scrolling calls are gone", async () => {
  const { interruption, call } = items(Date.now())
  const extra = Array.from({ length: 9 }, (_, i) => ({ ...call(`x${i}`), position: 100 + i }))
  const seeded = [...stepsOf(12), ...extra]
  const server = makeFakeServer()
  server.seedItems("s1", seeded)
  const screen = await render(view(server, { live: true }))
  await expect.element(earlierLine()).toBeVisible()
  expect(callList().scrollHeight).toBeGreaterThan(callList().clientHeight)

  server.pushItem({ ...interruption("i"), position: 1000 })
  await screen.rerender(view(server))

  await vi.waitFor(() => expect(turnLine().element().textContent).toMatch(/^Stopped after/))
  expect(earlierLine().query()).toBeNull()
  expect(page.getByTestId("turn-step").all()).toHaveLength(12)
  await page.getByTestId("step-summary").last().click()
  await expect.element(page.getByText("tool-x8")).toBeVisible()
  expect(callList().scrollHeight).toBe(callList().clientHeight)
})

test("while the turn runs, a step of 9 calls the user unfolds also stops at 8 rows", async () => {
  const { user, text, call } = items(Date.now())
  await mount(
    [
      user("u1"),
      text("t1", "Reading"),
      ...Array.from({ length: 9 }, (_, i) => call(`c${i + 1}`, "read")),
      text("t2", "Running"),
      call("r1", "command", "running"),
    ],
    true,
  )

  await page.getByTestId("step-summary").first().click()
  await expect.element(page.getByText("tool-c9")).toBeInTheDocument()
  const list = page
    .getByTestId("turn-step")
    .first()
    .element()
    .querySelector<HTMLElement>(".iv-turn__calls")!
  expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
  await vi.waitFor(() => expect(atListEnd(list)).toBe(true))
})

test("a steer heads its own step in the running turn, above the agent's reply, and the turn keeps its clock", async () => {
  const { user, text, call } = items(Date.now() - 20_000)
  const steer = (id: string, words: string): TranscriptItem =>
    ({ ...user(id, words), steer: true }) as TranscriptItem
  await mount(
    [
      user("u1", "fix it"),
      text("t1", "Looking at the code"),
      call("c1", "read"),
      steer("s1", "leave the e2e tests alone"),
      text("t2", "Understood, unit tests only"),
      call("c2", "command", "running"),
    ],
    true,
  )

  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "true")
  expect(turnLine().element().textContent).toMatch(/^Working for [12]\ds$/)
  const bubble = page.getByTestId("turn-steer")
  await expect.element(bubble).toHaveTextContent("leave the e2e tests alone")
  const steps = page.getByTestId("turn-step")
  await expect.element(steps).toHaveLength(2)
  expect(steps.nth(1).element().hasAttribute("data-steer")).toBe(true)
  expect(steps.nth(1).element().textContent).toMatch(
    /^leave the e2e tests alone.*Understood, unit tests only/,
  )
})
