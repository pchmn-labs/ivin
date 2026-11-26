import { RegistryContext, scheduleTask } from "@effect/atom-react"
import { builtinPlugins } from "../core/test-builtin-plugins.ts"
import { DateTime, Layer } from "effect"
import { AtomRegistry } from "effect/reactivity"
import { afterEach, expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { serverStateAtom } from "../modules/server/atoms/server-state.ts"
import { App } from "./app.tsx"

const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
const LOG_PATH = `/Users/someone-with-a-long-name/Library/Logs/ivin/${"nested-folder/".repeat(12)}server.log`

const mountApp = async ({ failVersion = false } = {}) => {
  const server = makeFakeServer({
    project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set(
    "s1",
    makeTestSession({
      id: "s1",
      title: "Work",
      projectPath: "/dev/ivin",
      workingFolder: "/dev/ivin",
    }),
  )
  server.openTab("s1")
  if (failVersion) server.failNextCall("server.getVersion")
  await page.viewport(1280, 800)
  const registry = AtomRegistry.make({
    scheduleTask,
    initialValues: [[serverClientLayerAtom, server.layer]],
  })
  await render(
    <RegistryContext.Provider value={registry}>
      <App plugins={builtinPlugins} />
    </RegistryContext.Provider>,
  )
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("ivin")
  // The desktop bridge gives the restarted server a new client, which rebuilds every atom that calls it.
  const serverBack = () => {
    registry.set(serverStateAtom, { kind: "running" })
    registry.set(serverClientLayerAtom, Layer.fresh(server.layer))
  }
  return { server, registry, serverBack }
}

afterEach(() => vi.unstubAllGlobals())

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
  const { registry, serverBack } = await mountApp()
  await expect.element(alert()).not.toBeInTheDocument()

  registry.set(serverStateAtom, { kind: "restarting" })
  await expect.element(alert()).toHaveTextContent("ivin's server stopped. Restarting it…")

  serverBack()
  await expect.element(alert()).not.toBeInTheDocument()
})

test("when the server does not answer, the alert says to reopen ivin and offers no Restart", async () => {
  await mountApp({ failVersion: true })
  await expect
    .element(alert())
    .toHaveTextContent("ivin's server is not answering. Quit and reopen ivin.")
  await expect.element(page.getByRole("button", { name: "Restart" })).not.toBeInTheDocument()
})

test("when the server gave up, a log path too long for a line stays inside the alert, with Restart in view", async () => {
  const { registry } = await mountApp()
  registry.set(serverStateAtom, { kind: "gave-up", logPath: LOG_PATH })

  const restart = page.getByRole("button", { name: "Restart" })
  await expect.poll(() => alert().element().textContent).toContain(`Its log is at ${LOG_PATH}.`)
  await expect.element(restart).toBeVisible()
  expect(alert().element().scrollWidth).toBeLessThanOrEqual(alert().element().clientWidth)
  expect(restart.element().getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
})

test("a Restart button the keyboard reaches calls the desktop's restart", async () => {
  const restart = vi.fn(() => Promise.resolve())
  vi.stubGlobal("ivin", { restartServer: restart })
  const { registry } = await mountApp()
  registry.set(serverStateAtom, { kind: "gave-up", logPath: "/home/.ivin/logs/ivin.log" })

  const button = page.getByRole("button", { name: "Restart" })
  for (let tabs = 0; tabs < 40 && document.activeElement?.textContent !== "Restart"; tabs++) {
    await userEvent.tab()
  }
  await expect.element(button).toHaveFocus()
  await userEvent.keyboard("{Enter}")
  expect(restart).toHaveBeenCalledOnce()
})

test("a draft's text and images survive the server being lost and coming back", async () => {
  const { registry, serverBack } = await mountApp()
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
  serverBack()
  await expect.element(alert()).not.toBeInTheDocument()

  await expect.element(field()).toHaveTextContent("look #1 please")
  await expect.element(thumbnail).toHaveAccessibleName("View image #1")
  expect(field().element()).toBe(composer)
})

test("a server that stopped before the built-in plugins loaded still shows its alert", async () => {
  const server = makeFakeServer()
  server.failCalls("plugin.listBuiltin")
  const registry = AtomRegistry.make({
    initialValues: [
      [serverClientLayerAtom, server.layer],
      [serverStateAtom, { kind: "restarting" }],
    ],
  })
  await render(
    <RegistryContext.Provider value={registry}>
      <App />
    </RegistryContext.Provider>,
  )

  await expect.element(alert()).toHaveTextContent("ivin's server stopped. Restarting it…")
})
