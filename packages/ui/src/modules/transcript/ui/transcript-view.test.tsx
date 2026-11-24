import { RegistryContext, RegistryProvider, useAtomMount } from "@effect/atom-react"
import { DateTime } from "effect"
import type { AtomRegistry } from "effect/reactivity"
import { useContext, useEffect } from "react"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { PAGE_SIZE, transcriptOf } from "../atoms/get-items.ts"
import { loadItemsBeforeAtom } from "../atoms/load-items-before.ts"
import { TranscriptView } from "./transcript-view.tsx"

const message = (position: number, text = `message ${position}`): TranscriptItem => ({
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

const userMessage = (position: number): TranscriptItem => ({
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

const toolCall = (position: number): TranscriptItem => ({
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

const scroller = () => document.querySelector<HTMLElement>('[data-testid="transcript"]')!
// The image files the transcript asks the window to load: one per <img> it has drawn.
const loadedImages = () =>
  [...document.querySelectorAll<HTMLImageElement>("img")].map((image) => image.getAttribute("src"))
// The browser sends the scroll event once the view has moved, after Virtuoso has seen it.
const scrollEvent = () =>
  new Promise<void>((resolve) =>
    scroller().addEventListener("scroll", () => resolve(), { once: true }),
  )
const topInView = (text: string) =>
  page.getByText(text, { exact: true }).element().getBoundingClientRect().top -
  scroller().getBoundingClientRect().top
const fromEnd = () => scroller().scrollHeight - scroller().clientHeight - scroller().scrollTop
const inView = (text: string) => {
  const top = topInView(text)
  return top >= 0 && top < scroller().clientHeight
}

test("the transcript stays put when scrolled up and follows when at the bottom", async () => {
  const server = makeFakeServer()
  server.seedItems(
    "s1",
    Array.from({ length: 40 }, (_, i) => message(i)),
  )
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: false,
    workingFolderDeleted: false,
    title: "New session",
    harness: "claude",
    model: "sonnet",
    effort: "high",
    permissionMode: "manual",
    relaunchFailure: null,
    pendingMessages: [],
    unreadMessages: [],
    backgroundTasks: [],
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber: 0,
    waitingFor: null,
  })

  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ height: 300 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )

  await expect.element(page.getByText("message 39", { exact: true })).toBeVisible()

  const scrolled = scrollEvent()
  scroller().dispatchEvent(new WheelEvent("wheel", { deltaY: -250 }))
  scroller().scrollTop -= 250
  await scrolled
  const scrolledUpTo = scroller().scrollTop
  const heightBefore = scroller().scrollHeight
  server.pushItem(message(40))
  await expect.poll(() => scroller().scrollHeight).toBeGreaterThan(heightBefore)
  expect(scroller().scrollTop).toBe(scrolledUpTo)

  // The virtual list grows as rows are measured, so one jump may stop short of the bottom.
  await vi.waitFor(() => {
    scroller().scrollTop = scroller().scrollHeight
    expect(page.getByText("message 40", { exact: true }).query()).not.toBeNull()
  })
  await expect.element(page.getByText("message 40", { exact: true })).toBeVisible()
  server.pushItem(message(41))
  await expect.element(page.getByText("message 41", { exact: true })).toBeVisible()
})

test("a transcript of 200 images loads only the images of the rows on screen", async () => {
  const server = makeFakeServer()
  server.seedItems(
    "s1",
    Array.from({ length: 200 }, (_, i) => ({
      id: `m${i}`,
      sessionId: "s1",
      position: i,
      at: 0,
      type: "message" as const,
      role: "user" as const,
      text: `shot ${i} [Image #${i + 1}]`,
      images: [{ id: `img-${i + 1}`, number: i + 1, mediaType: "image/png" as const }],
      steer: false,
    })),
  )

  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ height: 300 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )

  await expect.element(page.getByText("shot 199", { exact: false })).toBeVisible()
  await vi.waitFor(() => expect(loadedImages()).toContain("ivin-image://s1/img-200.png"))
  const onScreen = new Set(loadedImages())
  expect(onScreen.size).toBeLessThan(20)

  await vi.waitFor(() => {
    scroller().scrollTop = 0
    expect(loadedImages().some((src) => !onScreen.has(src))).toBe(true)
  })
  expect(new Set(loadedImages()).size).toBeLessThan(200)
})

// The seeded history is a turn that has ended; the session runs from the message the test sends.
const sessionView = (server: ReturnType<typeof makeFakeServer>, height: number, live: boolean) => (
  <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
    <div style={{ position: "relative", height }}>
      <PluginsProvider plugins={builtinPlugins}>
        <TranscriptView sessionId="s1" live={live} />
      </PluginsProvider>
    </div>
  </RegistryProvider>
)

const longAnswer = (position: number, lines = 30) =>
  message(position, Array.from({ length: lines }, (_, i) => `line ${i}`).join("\n\n"))

const sendQuestion = async (server: ReturnType<typeof makeFakeServer>) => {
  server.seedItems("s1", [userMessage(0), ...Array.from({ length: 39 }, (_, i) => message(i + 1))])
  const screen = await render(sessionView(server, 300, false))
  await expect.element(page.getByText("message 39", { exact: true })).toBeVisible()
  server.pushItem(userMessage(40))
  await expect.element(page.getByText("question 40", { exact: true })).toBeVisible()
  await screen.rerender(sessionView(server, 300, true))
  return screen
}

test("while the agent works, the transcript follows the end of its turn, however long", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)

  server.pushItem(toolCall(41))
  server.pushItem(longAnswer(42))
  await expect.element(page.getByText("line 29", { exact: true })).toBeInTheDocument()
  await expect.poll(fromEnd).toBeLessThan(2)
  expect(
    page.getByText("question 40", { exact: true }).query() !== null && inView("question 40"),
  ).toBe(false)

  server.pushItem(toolCall(43))
  await expect.element(page.getByText("command 43")).toBeInTheDocument()
  await expect.poll(fromEnd).toBeLessThan(2)
})

const everyFrame = <T,>(read: (frame: number) => T, done: (seen: T[]) => boolean) =>
  new Promise<T[]>((resolve) => {
    const seen: T[] = []
    const step = () => {
      seen.push(read(seen.length))
      if (done(seen)) resolve(seen)
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })

const streamLine = (index: number) =>
  ({
    type: "delta",
    sessionId: "s1",
    itemId: "m42",
    position: 42,
    kind: "message",
    text: `line ${index}\n\n`,
  }) as const

test("while the answer streams in fast, its last line stays in view", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)
  server.pushItem(toolCall(41))
  await expect.poll(fromEnd).toBeLessThan(2)

  const lags = await everyFrame(
    (frame) => {
      server.pushChange(streamLine(frame))
      return fromEnd()
    },
    (seen) => seen.length === 40,
  )

  expect(Math.max(...lags)).toBeLessThan(80)
})

test("while the answer streams in, the view moves at a steady pace", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)
  server.pushItem(toolCall(41))
  await expect.poll(fromEnd).toBeLessThan(2)

  const seen = await everyFrame(
    (frame) => {
      if (frame % 8 === 0) server.pushChange(streamLine(frame / 8))
      return { at: performance.now(), top: scroller().scrollTop }
    },
    (frames) => frames.length === 160,
  )

  // Frames do not all last as long, so the pace is read in pixels per millisecond.
  const paces = seen
    .slice(41)
    .map(({ at, top }, index) => (top - seen[40 + index]!.top) / (at - seen[40 + index]!.at))
  const median = paces.toSorted((a, b) => a - b)[paces.length >> 1]!
  const steady = paces.filter((pace) => pace > median / 1.5 && pace < median * 1.5)
  expect(steady.length).toBeGreaterThan(0.8 * paces.length)
})

const messageRowTop = () => {
  const row = document.querySelector('[data-row-id="m40"]')
  return row && Math.round(row.getBoundingClientRect().top - scroller().getBoundingClientRect().top)
}

test("a turn that ends with a long answer moves its message to the top of the view in one step", async () => {
  const server = makeFakeServer()
  const screen = await sendQuestion(server)
  for (let position = 41; position < 47; position++) server.pushItem(toolCall(position))
  server.pushItem(longAnswer(47))
  await expect.poll(fromEnd).toBeLessThan(2)

  void screen.rerender(sessionView(server, 300, false))
  const frames = await everyFrame(
    // Read cheaply, or the frames between Virtuoso's corrections are not seen.
    () => ({ top: messageRowTop(), answer: document.querySelector('[data-row-id="m47"]') }),
    (seen) => Math.abs(seen.at(-1)!.top ?? Number.POSITIVE_INFINITY) < 2,
  )

  // Before the turn ends, its message is above the view and not drawn.
  const ended = frames.filter((frame) => frame.top !== null)
  expect(ended).toHaveLength(1)
  expect(ended[0]!.answer).not.toBeNull()
  expect(fromEnd()).toBeGreaterThan(100)
})

test("a turn that ends with a short answer stays at the end, its message in view", async () => {
  const server = makeFakeServer()
  const screen = await sendQuestion(server)
  server.pushItem(toolCall(41))
  server.pushItem(message(42))
  await expect.element(page.getByText("message 42", { exact: true })).toBeVisible()

  void screen.rerender(sessionView(server, 300, false))
  const lags = await everyFrame(fromEnd, () => messageRowTop() !== null)

  expect(Math.max(...lags)).toBeLessThan(2)
  expect(inView("question 40")).toBe(true)
})

test("scrolled up while the agent works, the transcript stays put", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)
  server.pushItem(longAnswer(41))
  await expect.poll(fromEnd).toBeLessThan(2)

  const scrolled = scrollEvent()
  scroller().dispatchEvent(new WheelEvent("wheel", { deltaY: -200 }))
  scroller().scrollTop -= 200
  await scrolled
  const scrolledUpTo = scroller().scrollTop
  const heightBefore = scroller().scrollHeight
  server.pushItem(longAnswer(42))
  await expect.poll(() => scroller().scrollHeight).toBeGreaterThan(heightBefore)
  expect(scroller().scrollTop).toBe(scrolledUpTo)
})

test("scrolled back to the end, the transcript follows its end again", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)
  server.pushItem(longAnswer(41))
  await expect.poll(fromEnd).toBeLessThan(2)
  const scrolled = scrollEvent()
  scroller().dispatchEvent(new WheelEvent("wheel", { deltaY: -200 }))
  scroller().scrollTop -= 200
  await scrolled

  await vi.waitFor(() => {
    scroller().scrollTop = scroller().scrollHeight
    scroller().dispatchEvent(new Event("scroll"))
    expect(fromEnd()).toBeLessThan(2)
  })
  server.pushItem(message(42))
  await expect.element(page.getByText("message 42", { exact: true })).toBeVisible()
  await expect.poll(fromEnd).toBeLessThan(2)
})

const thinking = (position: number): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "thinking",
  text: "thinking",
})

// Its steps fold into fewer rows than fill the view.
const longTurn = (): TranscriptItem[] => [
  userMessage(0),
  message(1),
  userMessage(2),
  ...Array.from({ length: 3 * PAGE_SIZE + 30 }, (_, i) =>
    [message, thinking, toolCall, toolCall, toolCall][i % 5]!(i + 3),
  ),
]

test.each([true, false])(
  "scrolling up a turn of several pages reaches its message and the turn before (live: %s)",
  async (live) => {
    const server = makeFakeServer()
    server.seedItems("s1", longTurn())

    await render(
      <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
        <div style={{ position: "relative", height: 900 }}>
          <PluginsProvider plugins={builtinPlugins}>
            <TranscriptView sessionId="s1" live={live} />
          </PluginsProvider>
        </div>
      </RegistryProvider>,
    )
    await expect.element(page.getByTestId("transcript-work")).toBeInTheDocument()

    await vi.waitFor(() => {
      scroller().scrollTop = 0
      expect(page.getByText("question 2", { exact: true }).query()).not.toBeNull()
      expect(page.getByText("question 0", { exact: true }).query()).not.toBeNull()
    })
  },
)

// The session's tab keeps its transcript in memory while the view is closed, as switching tabs does.
function KeptTranscript() {
  useAtomMount(transcriptOf("s1").list.ids)
  return null
}

const switchableView = (
  server: ReturnType<typeof makeFakeServer>,
  shown: boolean,
  live = false,
) => (
  <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
    <KeptTranscript />
    <div style={{ position: "relative", height: 300 }}>
      <PluginsProvider plugins={builtinPlugins}>
        {shown && <TranscriptView sessionId="s1" live={live} />}
      </PluginsProvider>
    </div>
  </RegistryProvider>
)

const fortyMessages = () => Array.from({ length: 40 }, (_, i) => message(i))

const closeAndOpen = async (
  screen: Awaited<ReturnType<typeof render>>,
  server: ReturnType<typeof makeFakeServer>,
  meanwhile: () => void = () => {},
  live = false,
) => {
  await screen.rerender(switchableView(server, false, live))
  await expect.element(page.getByTestId("transcript")).not.toBeInTheDocument()
  meanwhile()
  await screen.rerender(switchableView(server, true, live))
}

test("the transcript opens again where the user had scrolled it", async () => {
  const server = makeFakeServer()
  server.seedItems("s1", fortyMessages())
  const screen = await render(switchableView(server, true))
  await expect.element(page.getByText("message 39", { exact: true })).toBeVisible()
  scroller().dispatchEvent(new WheelEvent("wheel", { deltaY: -250 }))
  scroller().scrollTop -= 250
  // The browser would send it a frame later.
  scroller().dispatchEvent(new Event("scroll"))
  const scrolledTo = scroller().scrollTop

  await closeAndOpen(screen, server)

  await vi.waitFor(() => expect(Math.abs(scroller().scrollTop - scrolledTo)).toBeLessThan(2))
})

test("a transcript left at its end opens again at its end, with the items that came meanwhile", async () => {
  const server = makeFakeServer()
  server.seedItems("s1", fortyMessages())
  const screen = await render(switchableView(server, true))
  await expect.element(page.getByText("message 39", { exact: true })).toBeVisible()

  await closeAndOpen(screen, server, () => {
    for (let i = 40; i < 45; i++) server.pushItem(message(i))
  })

  await expect.element(page.getByText("message 44", { exact: true })).toBeVisible()
})

let registry!: AtomRegistry.AtomRegistry
function CaptureRegistry() {
  const context = useContext(RegistryContext)
  useEffect(() => {
    registry = context
  }, [context])
  return null
}

const heldView = (server: ReturnType<typeof makeFakeServer>, shown: boolean) => (
  <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
    <CaptureRegistry />
    <KeptTranscript />
    <div style={{ position: "relative", height: 300 }}>
      <PluginsProvider plugins={builtinPlugins}>
        {shown && <TranscriptView sessionId="s1" />}
      </PluginsProvider>
    </div>
  </RegistryProvider>
)

test("a transcript left at its end keeps only its last page, and scrolling up loads the older ones again", async () => {
  const server = makeFakeServer()
  const total = PAGE_SIZE * 3
  server.seedItems(
    "s1",
    Array.from({ length: total }, (_, i) => message(i)),
  )
  const screen = await render(heldView(server, true))
  await expect.element(page.getByText(`message ${total - 1}`, { exact: true })).toBeVisible()
  const ids = () => registry.get(transcriptOf("s1").list.ids)
  registry.mount(loadItemsBeforeAtom)
  registry.set(loadItemsBeforeAtom, "s1")
  await vi.waitFor(() => expect(ids()).toHaveLength(PAGE_SIZE * 2))

  await screen.rerender(heldView(server, false))
  await vi.waitFor(() => expect(ids()).toHaveLength(PAGE_SIZE))
  expect(registry.get(transcriptOf("s1").paging).hasBefore).toBe(true)

  await screen.rerender(heldView(server, true))
  await expect.element(page.getByText(`message ${total - 1}`, { exact: true })).toBeVisible()
  scroller().dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
  await vi.waitFor(() => {
    scroller().scrollTop = 0
    expect(page.getByText(`message ${PAGE_SIZE}`, { exact: true }).query()).not.toBeNull()
  })
})

test("a transcript left scrolled back keeps the pages it has", async () => {
  const server = makeFakeServer()
  const total = PAGE_SIZE * 3
  server.seedItems(
    "s1",
    Array.from({ length: total }, (_, i) => message(i)),
  )
  const screen = await render(heldView(server, true))
  await expect.element(page.getByText(`message ${total - 1}`, { exact: true })).toBeVisible()
  scroller().dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
  await vi.waitFor(() => {
    scroller().scrollTop = 0
    expect(page.getByText(`message ${PAGE_SIZE}`, { exact: true }).query()).not.toBeNull()
  })
  scroller().dispatchEvent(new Event("scroll"))

  await screen.rerender(heldView(server, false))
  await expect.element(page.getByTestId("transcript")).not.toBeInTheDocument()
  expect(registry.get(transcriptOf("s1").list.ids).length).toBeGreaterThan(PAGE_SIZE)
})

test("a transcript that cannot load says so with Retry, and Retry loads it", async () => {
  const server = makeFakeServer()
  server.seedItems("s1", [message(0)])
  server.failNextCall("transcript.watchItems")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ position: "relative", height: 300 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )

  await expect.element(page.getByText("The transcript could not be loaded.")).toBeVisible()
  expect(document.body.textContent).not.toContain("Loading the transcript")

  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByText("message 0", { exact: true })).toBeVisible()
  expect(document.body.textContent).not.toContain("could not be loaded")
})

test("a transcript of a session that no longer exists says that, with no Retry", async () => {
  const server = makeFakeServer()
  server.failNextCall("transcript.watchItems")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ position: "relative", height: 300 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" sessionGone />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )

  await expect.element(page.getByText("This session no longer exists.")).toBeVisible()
  expect(page.getByRole("button", { name: "Retry" }).query()).toBeNull()
})

const sendMessage = async (server: ReturnType<typeof makeFakeServer>) => {
  server.seedItems("s1", [userMessage(0), ...Array.from({ length: 39 }, (_, i) => message(i + 1))])
  const screen = await render(switchableView(server, true))
  await expect.element(page.getByText("message 39", { exact: true })).toBeVisible()
  server.pushItem(userMessage(40))
  await expect.element(page.getByText("question 40", { exact: true })).toBeVisible()
  await screen.rerender(switchableView(server, true, true))
  return screen
}

test("a transcript closed during a turn and opened again after it shows its rows, never an empty area", async () => {
  const server = makeFakeServer()
  const screen = await sendMessage(server)

  await closeAndOpen(screen, server, () => server.pushItem(message(41, "the answer")), true)

  await expect.element(page.getByText("the answer", { exact: true })).toBeVisible()
  await vi.waitFor(() => expect(fromEnd()).toBeLessThan(2))
})

test("a long answer that came while the transcript was closed opens at its end", async () => {
  const server = makeFakeServer()
  const screen = await sendMessage(server)

  await closeAndOpen(screen, server, () => server.pushItem(longAnswer(41)), true)

  await expect.element(page.getByText("line 29", { exact: true })).toBeVisible()
  await vi.waitFor(() => expect(fromEnd()).toBeLessThan(2))
})

test("a transcript closed after a turn ended with a long answer opens again at the turn's message", async () => {
  const server = makeFakeServer()
  const screen = await sendMessage(server)
  server.pushItem(toolCall(41))
  server.pushItem(longAnswer(42))
  await expect.poll(fromEnd).toBeLessThan(2)
  await screen.rerender(switchableView(server, true, false))
  await expect.poll(() => Math.abs(messageRowTop() ?? Number.POSITIVE_INFINITY)).toBeLessThan(2)

  await closeAndOpen(screen, server)

  await expect.poll(() => Math.abs(messageRowTop() ?? Number.POSITIVE_INFINITY)).toBeLessThan(2)
})

test("a session with no message yet says so", async () => {
  const server = makeFakeServer()
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ position: "relative", height: 300 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )

  await expect.element(page.getByText("No messages yet. Write to the agent below.")).toBeVisible()
})
