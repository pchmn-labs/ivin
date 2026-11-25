import { RegistryContext, RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import type { AtomRegistry } from "effect/reactivity"
import { useContext, useEffect } from "react"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { serverStateAtom } from "../modules/server/atoms/server-state.ts"
import { App } from "./app.tsx"

const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
const LOG_PATH = `/Users/someone-with-a-long-name/Library/Logs/ivin/${"nested-folder/".repeat(12)}server.log`

let registry: AtomRegistry.AtomRegistry
function CaptureRegistry() {
  const current = useContext(RegistryContext)
  useEffect(() => {
    registry = current
  }, [current])
  return null
}

const mountApp = async () => {
  const at = DateTime.makeUnsafe(0)
  const server = makeFakeServer({ project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: at } })
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/dev/ivin",
    workingFolder: "/dev/ivin",
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: "Work",
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
  server.openTab("s1")
  await page.viewport(1280, 800)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <CaptureRegistry />
      <App />
    </RegistryProvider>,
  )
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("ivin")
  return server
}

const field = () => page.getByRole("textbox", { name: "Message" })
const alert = () => page.getByRole("alert")

test("the status at the settings navigation's foot shows the version once the server answers", async () => {
  await mountApp()
  await page.getByRole("button", { name: "Settings" }).click()
  await expect
    .element(page.getByRole("navigation", { name: "Settings sections" }).getByText(/^ivin \S+/))
    .toBeVisible()
})

test("while the server restarts, an alert says so, and it goes when the server is back", async () => {
  await mountApp()
  await expect.element(alert()).not.toBeInTheDocument()

  registry.set(serverStateAtom, { kind: "restarting" })
  await expect.element(alert()).toHaveTextContent("ivin's server stopped. Restarting it…")

  registry.set(serverStateAtom, { kind: "running" })
  await expect.element(alert()).not.toBeInTheDocument()
})

test("when the server gave up, the alert names a log path too long for a line and keeps the Restart button in view", async () => {
  await mountApp()
  registry.set(serverStateAtom, { kind: "gave-up", logPath: LOG_PATH })

  const restart = page.getByRole("button", { name: "Restart" })
  await expect.poll(() => alert().element().textContent).toContain(`Its log is at ${LOG_PATH}.`)
  await expect.element(restart).toBeVisible()
  const box = restart.element().getBoundingClientRect()
  expect(box.right).toBeLessThanOrEqual(window.innerWidth)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
})

test("a draft's text and images survive the server being lost and coming back", async () => {
  await mountApp()
  await field().click()
  await userEvent.keyboard("look ")
  const data = new DataTransfer()
  data.items.add(
    new File([Uint8Array.from(atob(PIXEL), (c) => c.charCodeAt(0))], "shot.png", {
      type: "image/png",
    }),
  )
  field()
    .element()
    .dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    )
  await userEvent.keyboard("please")
  const thumbnail = page.getByTestId("draft-images").getByRole("button", { name: /View image/ })
  await expect.element(thumbnail).toBeVisible()
  const composer = field().element()

  registry.set(serverStateAtom, { kind: "restarting" })
  await expect.element(alert()).toBeVisible()
  expect(field().element()).toBe(composer)
  registry.set(serverStateAtom, { kind: "running" })
  await expect.element(alert()).not.toBeInTheDocument()

  expect(field().element()).toBe(composer)
  expect(field().element().textContent).toContain("look")
  expect(field().element().textContent).toContain("please")
  await expect.element(thumbnail).toHaveAccessibleName("View image #1")
})
