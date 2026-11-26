import { RegistryContext, RegistryProvider, useAtomMount } from "@effect/atom-react"
import type { AtomRegistry } from "effect/reactivity"
import { useContext, useEffect } from "react"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../core/test-builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { PAGE_SIZE, transcriptOf } from "../atoms/get-items.ts"
import { loadItemsBeforeAtom } from "../atoms/load-items-before.ts"
import { fromEnd, message, scrollEvent, scroller, toolCall, userMessage } from "../test-items.ts"
import { TranscriptView } from "./transcript-view.tsx"

// The image files the transcript asks the window to load: one per <img> it has drawn.
const loadedImages = () =>
  [...document.querySelectorAll<HTMLImageElement>("img")].map((image) => image.getAttribute("src"))

test("the transcript stays put when scrolled up and follows when at the bottom", async () => {
  const server = makeFakeServer()
  server.seedItems(
    "s1",
    Array.from({ length: 40 }, (_, i) => message(i)),
  )
  server.sessions.set("s1", makeTestSession({ id: "s1", started: false, title: "New session" }))

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

const longAnswer = (position: number, lines = 30) =>
  message(position, Array.from({ length: lines }, (_, i) => `line ${i}`).join("\n\n"))

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

test("scrolling up loads past the pages that hold only a subagent's steps", async () => {
  const server = makeFakeServer()
  const steps = PAGE_SIZE * 2
  server.seedItems("s1", [
    userMessage(0),
    toolCall(1),
    ...Array.from({ length: steps }, (_, i) => ({ ...toolCall(i + 2), parentToolCallId: "t1" })),
    ...Array.from({ length: PAGE_SIZE }, (_, i) => message(steps + 2 + i)),
  ])
  await render(heldView(server, true))
  await expect
    .element(page.getByText(`message ${steps + PAGE_SIZE + 1}`, { exact: true }))
    .toBeVisible()

  scroller().dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
  await vi.waitFor(() => {
    scroller().scrollTop = 0
    expect(page.getByText("question 0", { exact: true }).query()).not.toBeNull()
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

test.each([
  ["short", message(41, "the answer"), "the answer"],
  ["long", longAnswer(41), "line 29"],
])(
  "a %s answer that came while the transcript was closed opens at its end, never an empty area",
  async (_, answer, text) => {
    const server = makeFakeServer()
    const screen = await sendMessage(server)

    await closeAndOpen(screen, server, () => server.pushItem(answer), true)

    await expect.element(page.getByText(text, { exact: true })).toBeVisible()
    await vi.waitFor(() => expect(fromEnd()).toBeLessThan(2))
  },
)

test("a transcript closed after a turn ended with a long answer opens again at its end", async () => {
  const server = makeFakeServer()
  const screen = await sendMessage(server)
  server.pushItem(toolCall(41))
  server.pushItem(longAnswer(42))
  await expect.poll(fromEnd).toBeLessThan(2)
  await screen.rerender(switchableView(server, true, false))

  await closeAndOpen(screen, server)

  await expect.element(page.getByText("line 29", { exact: true })).toBeVisible()
  await vi.waitFor(() => expect(fromEnd()).toBeLessThan(2))
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
