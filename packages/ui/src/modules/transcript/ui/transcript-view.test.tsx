import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { TranscriptView } from "./transcript-view.tsx"

const message = (position: number): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "message",
  role: "assistant",
  text: `message ${position}`,
  images: [],
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
})

const scroller = () => document.querySelector<HTMLElement>('[data-testid="transcript"]')!
// The image files the transcript asks the window to load: one per <img> it has drawn.
const loadedImages = () =>
  [...document.querySelectorAll<HTMLImageElement>("img")].map((image) => image.getAttribute("src"))
const frames = () => new Promise((resolve) => setTimeout(resolve, 150))

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
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber: 0,
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

  scroller().scrollTop -= 250
  await frames()
  const scrolledUpTo = scroller().scrollTop
  server.pushItem(message(40))
  await vi.waitFor(() => expect(document.body.textContent).not.toContain("message 40"))
  await frames()
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

  for (let i = 0; i < 5; i++) {
    scroller().scrollTop = 0
    await frames()
  }
  await vi.waitFor(() => expect(loadedImages().some((src) => !onScreen.has(src))).toBe(true))
  expect(new Set(loadedImages()).size).toBeLessThan(200)
})

test("a sent message scrolls up to the top of the view, and stays there while the answer is short", async () => {
  const server = makeFakeServer()
  server.seedItems("s1", [userMessage(0), ...Array.from({ length: 39 }, (_, i) => message(i + 1))])

  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ position: "relative", height: 300 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" live />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )
  await expect.element(page.getByText("message 39", { exact: true })).toBeVisible()

  const topInView = (text: string) =>
    page.getByText(text, { exact: true }).element().getBoundingClientRect().top -
    scroller().getBoundingClientRect().top

  server.pushItem(userMessage(40))
  await vi.waitFor(() => expect(topInView("question 40")).toBeLessThan(30))
  server.pushItem(message(41))
  await expect.element(page.getByText("message 41", { exact: true })).toBeVisible()
  await frames()
  expect(topInView("question 40")).toBeLessThan(30)
})

test("loading the older items of a long turn does not scroll to its message", async () => {
  const server = makeFakeServer()
  server.seedItems("s1", [userMessage(0), ...Array.from({ length: 80 }, (_, i) => message(i + 1))])

  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ position: "relative", height: 300 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )
  await expect.element(page.getByText("message 80", { exact: true })).toBeVisible()

  await vi.waitFor(() => {
    scroller().scrollTop = 0
    expect(page.getByText("question 0", { exact: true }).query()).not.toBeNull()
  })
  await frames()
  const room = document.querySelector<HTMLElement>(".iv-transcript")!.style
  expect(room.getPropertyValue("--iv-transcript-room")).toBe("")
})
