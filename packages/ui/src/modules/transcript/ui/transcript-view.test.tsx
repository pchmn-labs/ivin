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
  type: "message",
  role: "assistant",
  text: `message ${position}`,
})

const scroller = () => document.querySelector<HTMLElement>('[data-testid="transcript"]')!
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
    model: "sonnet",
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
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
